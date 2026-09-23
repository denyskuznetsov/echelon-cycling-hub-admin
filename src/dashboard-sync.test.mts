import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { resolveDashboardPeriod } from "./lib/dashboard/period.ts";

const require = createRequire(import.meta.url);
function load(path: string, mocks: Record<string, unknown>): Record<string, (...args: any[]) => any> {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id: string) => mocks[id] ?? require(id), module, module.exports);
  return module.exports;
}
const run = (id: string, state = "failed", from = "2026-10-25", created = id) => ({
  id, scope: "selected_period", policy_version: 1, from_date: from, to_date: from,
  state, discovery_phase: "reconcile", discovery_page: 1, listed: 1, succeeded: state === "succeeded" ? 1 : 0,
  failed: state === "failed" ? 1 : 0, skipped: 0, last_error: "Provider unavailable", last_attempt_at: "2026-10-25T10:00:00Z",
  created_at: created, finished_at: state === "succeeded" ? "2026-10-25T10:00:00Z" : null,
});
type Row = ReturnType<typeof run>;
function fixture(rows: Row[], failedRead: string | null = null) {
  const queries: { method: string; args: unknown[] }[][] = [];
  const client = { from(table: string) {
    const calls = [{ method: "from", args: [table] }]; queries.push(calls);
    const filters: ((r: Row) => boolean)[] = [];
    const sorts: { key: string; ascending: boolean }[] = [];
    let cap = Infinity;
    let columns = "";
    const q = {
      select(value: string) { columns = value; calls.push({ method: "select", args: [value] }); return q; },
      eq(key: string, value: unknown) { calls.push({ method: "eq", args: [key, value] }); filters.push((r) => r[key as keyof Row] === value); return q; },
      not(key: string, op: string, value: unknown) { calls.push({ method: "not", args: [key, op, value] }); filters.push((r) => r[key as keyof Row] !== value); return q; },
      order(key: string, options: { ascending: boolean }) { calls.push({ method: "order", args: [key, options] }); sorts.push({ key, ...options }); return q; },
      limit(value: number) { cap = value; calls.push({ method: "limit", args: [value] }); return q; },
      async maybeSingle() {
        if (failedRead === columns || failedRead === "all") return { data: null, error: { message: "Fixture read failure" } };
        const matches = rows.filter((r) => filters.every((f) => f(r))).sort((a, b) => {
          for (const s of sorts) { const v = String(a[s.key as keyof Row]).localeCompare(String(b[s.key as keyof Row])); if (v) return s.ascending ? v : -v; }
          return 0;
        }).slice(0, cap);
        return { data: matches[0] ?? null, error: null };
      },
    };
    return q;
  } };
  const health = load("src/lib/workshop/data/sync-health.ts", {
    "@/src/utils/supabase/server": { createClient: async () => client },
    "@/src/lib/workshop/domain": { isManualSyncScope: () => true, isWorkshopSyncRunState: (v: unknown) => ["failed", "in_progress", "succeeded"].includes(String(v)) },
  });
  const calls: string[] = [];
  let workerResult: unknown = { ok: true, state: "succeeded", runId: "new" };
  const actions = (allowed = true) => load("src/lib/workshop/actions/sync-actions.ts", {
    "@/src/utils/supabase/server": { createClient: async () => client },
    "@/src/utils/auth/with-auth": { withAuth: (_name: string, action: (...args: any[]) => any) => (...args: any[]) => action({ id: "authenticated-staff" }, ...args) },
    "@/src/lib/workshop/domain": { isManualSyncScope: () => true },
    "@/src/lib/workshop/data/sync-health": health,
    "@/src/lib/dashboard/period": { resolveDashboardPeriod },
    "@/src/lib/workshop/application/sync-env": { workshopSyncAllowed: () => allowed },
    "@/src/lib/workshop/application/manual-sync": {
      runSelectedPeriodStart: async (_c: unknown, from: string, to: string) => { calls.push(`start:${from}:${to}`); return workerResult; },
      runSelectedPeriodResume: async (_c: unknown, id: string) => { calls.push(`resume:${id}`); return workerResult; },
    },
  });
  return { client, health, queries, actions, calls, setResult: (r: unknown) => { workerResult = r; } };
}

test("bounded exact-date selection uses latest run before recovery and independent Dashboard success history", async () => {
  const f = fixture([run("01"), run("02", "succeeded"), run("03", "failed", "2026-11-01"),
    { ...run("04", "succeeded"), scope: "all_reserved", finished_at: "2026-11-01T12:00:00Z" }]);
  const result = await f.health.loadSelectedPeriodSyncHealth("2026-10-25", "2026-10-25");
  assert.equal(result.health.runId, "02");
  assert.equal(result.lastSuccessAt, "2026-10-25T10:00:00Z");
  for (const q of f.queries) assert.ok(q.some((c) => c.method === "limit" && c.args[0] === 1));
  assert.ok(f.queries[0].some((c) => c.method === "eq" && c.args[0] === "from_date"));
  assert.ok(!f.queries[0].some((c) => c.method === "eq" && c.args[0] === "state"));
  assert.ok(!f.queries[1].some((c) => c.method === "eq" && c.args[0] === "from_date"));
  const otherPeriod = await f.health.loadSelectedPeriodSyncHealth("2026-12-01", "2026-12-01");
  assert.equal(otherPeriod.health, null);
  assert.equal(otherPeriod.lastSuccessAt, result.lastSuccessAt);
});

test("success history survives newer failure and distinguishes no history from failed history read", async () => {
  const rows = [run("01", "succeeded"), run("02", "failed")];
  const good = await fixture(rows).health.loadSelectedPeriodSyncHealth("2026-10-25", "2026-10-25");
  assert.equal(good.health.state, "failed");
  assert.ok(good.lastSuccessAt);
  const empty = await fixture([]).health.loadSelectedPeriodSyncHealth("2026-10-25", "2026-10-25");
  assert.equal(empty.lastSuccessAt, null); assert.equal(empty.error, null);
  const failed = await fixture(rows, "finished_at").health.loadSelectedPeriodSyncHealth("2026-10-25", "2026-10-25");
  assert.equal(failed.lastSuccessAt, null); assert.equal(failed.error, "Fixture read failure");
});

test("one start action selects exact-date recovery at action time and never falls back after resume failure", async () => {
  for (const state of ["failed", "in_progress", "succeeded"]) {
    const f = fixture([run("01", "failed"), run("02", state), run("03", "failed", "2026-11-01")]);
    const denied = { ok: false, code: "SYNC_IN_PROGRESS", error: "Active lease" };
    f.setResult(denied);
    assert.deepEqual(await f.actions().startSelectedPeriodSync("2026-10-25", "2026-10-25"), denied);
    assert.deepEqual(f.calls, [state === "succeeded" ? "start:2026-10-25:2026-10-25" : "resume:02"]);
  }
  const unrelated = fixture([run("01", "failed", "2026-11-01")]);
  await unrelated.actions().startSelectedPeriodSync("2026-10-25", "2026-10-25");
  assert.deepEqual(unrelated.calls, ["start:2026-10-25:2026-10-25"]);
});

test("terminal failed worker results surface persisted failure detail and honest missing-detail fallback", async () => {
  const f = fixture([run("01")]);
  f.setResult({ ok: true, state: "failed", runId: "01" });
  const result = await f.actions().resumeSelectedPeriodSync("01");
  assert.equal(result.ok, false); assert.equal(result.error, "Provider unavailable");
  f.setResult({ ok: true, state: "failed", runId: "missing" });
  assert.match((await f.actions().resumeSelectedPeriodSync("missing")).error, /could not refresh all required orders/);
});

test("invalid periods, disabled environments, malformed metadata and read failures cannot start work", async () => {
  const f = fixture([]);
  assert.equal((await f.actions(false).startSelectedPeriodSync("2026-10-25", "2026-10-25")).ok, false);
  assert.equal((await f.actions().startSelectedPeriodSync("bad", "2026-10-25")).ok, false);
  assert.equal((await f.actions().startSelectedPeriodSync("2026-10-26", "2026-10-25")).ok, false);
  assert.equal(f.calls.length, 0); assert.equal(f.queries.length, 0);
  for (const broken of [fixture([], "all"), fixture([{ ...run("01"), policy_version: 99 }])]) {
    assert.equal((await broken.actions().startSelectedPeriodSync("2026-10-25", "2026-10-25")).ok, false);
    assert.equal(broken.calls.length, 0);
  }
});
