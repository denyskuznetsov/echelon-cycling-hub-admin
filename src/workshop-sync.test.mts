import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";
import { resolveDashboardPeriod } from "./lib/dashboard/period.ts";
import { fileURLToPath } from "node:url";
import {
  paginationNextUrl,
  parseOrderListDocument,
  fetchSelectedPeriodOrderListPage,
  fetchWorkshopWindowOrderListPage,
  SOURCE_ORDER_INCLUDE,
} from "./lib/booqable/fetch-source-snapshot.ts";
import {
  decodeSyncCursor,
  encodeSyncCursor,
  isEligibleManualSyncOrder,
  selectedPeriodEligible,
  skipReason,
} from "./lib/workshop/domain/commands.ts";

import {
  classifyBooqableWebhookEvent,
  customerWebhookDestWritesAllowed,
  dispatchBooqableWebhookEvent,
  parseBooqableWebhookOrderId,
  sandboxBackfillAllowed,
  webhookDeliveryStatus,
  workshopSyncAllowed,
} from "./lib/workshop/application/sync-env.ts";

test("selected period considers both dates, all workload statuses, and saved instants", () => {
  const windowStart = "2026-10-25T00:00:00Z";
  const windowEnd = "2026-10-25T23:00:00Z";
  const order = {
    status: "started", startsAt: "2026-10-25T02:30:00Z",
    stopsAt: "2026-10-25T20:00:00Z",
  };
  assert.equal(selectedPeriodEligible(order, "starts_at", windowStart, windowEnd), true);
  assert.equal(selectedPeriodEligible(order, "stops_at", windowStart, windowEnd), true);
  assert.equal(selectedPeriodEligible({ ...order, status: "canceled" }, "stops_at", windowStart, windowEnd), false);
  assert.equal(selectedPeriodEligible({ ...order, stopsAt: windowEnd }, "stops_at", windowStart, windowEnd), false);
  assert.throws(() => selectedPeriodEligible({ ...order, status: null }, "starts_at", windowStart, windowEnd));
  assert.throws(() => selectedPeriodEligible({ ...order, stopsAt: "bad" }, "stops_at", windowStart, windowEnd));
});

test("selected-period listing requests the saved start or return interval and parses both dates", async () => {
  const originalFetch = globalThis.fetch;
  const urls: URL[] = [];
  globalThis.fetch = async (input) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify({ data: [{
      id: "source-both", attributes: {
        status: "stopped", number: 42,
        starts_at: "2026-10-25T08:00:00Z", stops_at: "2026-10-25T19:00:00Z",
      },
    }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const bounds = ["2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"] as const;
    const page = await fetchSelectedPeriodOrderListPage("stops_at", 2, ...bounds, {
      BOOQABLE_COMPANY_SLUG: "fixture", BOOQABLE_API_KEY: "fixture-key",
    });
    assert.equal(page.orders[0]?.stopsAt, "2026-10-25T19:00:00Z");
    assert.equal(urls[0]?.searchParams.get("filter[stops_at][gte]"), bounds[0]);
    assert.equal(urls[0]?.searchParams.get("filter[stops_at][lt]"), bounds[1]);
    assert.equal(urls[0]?.searchParams.get("page[number]"), "2");
    assert.match(urls[0]?.searchParams.get("fields[orders]") ?? "", /stops_at/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Workshop listing filters reserved starts within saved bounds upstream", async () => {
  const originalFetch = globalThis.fetch;
  let requested: URL | null = null;
  globalThis.fetch = async (input) => {
    requested = new URL(String(input));
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const from = "2026-10-24T22:00:00Z";
    const to = "2026-10-31T23:00:00Z";
    const page = await fetchWorkshopWindowOrderListPage(3, from, to, {
      BOOQABLE_COMPANY_SLUG: "fixture", BOOQABLE_API_KEY: "fixture-key",
    });
    assert.deepEqual(page.orders, []);
    assert.equal((requested as URL | null)?.searchParams.get("filter[status]"), "reserved");
    assert.equal((requested as URL | null)?.searchParams.get("filter[starts_at][gte]"), from);
    assert.equal((requested as URL | null)?.searchParams.get("filter[starts_at][lt]"), to);
    assert.equal((requested as URL | null)?.searchParams.get("page[number]"), "3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const testRequire = createRequire(import.meta.url);
const selectedRunId = "11111111-1111-4111-8111-111111111111";
type SelectedFixture = {
  scope?: "selected_period" | "next_7_days";
  allowed?: boolean;
  serviceError?: boolean;
  finishError?: boolean;
  malformedStart?: boolean;
  missingRunId?: boolean;
  pages?: Record<string, { orders: Record<string, unknown>[]; hasMore: boolean }>;
  reconcile?: (id: string) => { ok: boolean; code?: string; error?: string };
};

function selectedWorker(fixture: SelectedFixture = {}) {
  const scope = fixture.scope ?? "selected_period";
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const fetched: { direction: string; page: number; from: string; to: string }[] = [];
  const candidates = new Map<string, "pending" | "failed" | "succeeded">();
  const saved = {
    phase: "starts_at", page: 1, state: "in_progress", error: "" as string,
    from: "2026-10-24T22:00:00Z", to: scope === "next_7_days" ? "2026-10-31T23:00:00Z" : "2026-10-25T23:00:00Z",
  };
  const payload = () => ({
    ok: true, runId: selectedRunId, scope, state: saved.state, cursor: null,
    counts: { listed: candidates.size, succeeded: [...candidates.values()].filter((v) => v === "succeeded").length,
      failed: [...candidates.values()].filter((v) => v === "failed").length, skipped: 0 },
    token: "lease", fence: 1, phase: saved.phase, page: saved.page,
    fromInstant: saved.from, toInstantExclusive: saved.to, policyVersion: scope === "selected_period" ? 1 : 2,
  });
  const user = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "dashboard_abort_selected_sync") {
      saved.state = "failed"; saved.error = String(args.reason); return { data: { ok: true }, error: null };
    }
    if (name === "dashboard_resume_selected_sync" || name === "workshop_resume_window_sync") {
      assert.equal(args.run_id, selectedRunId);
      return { data: payload(), error: null };
    }
    assert.equal(name, scope === "selected_period" ? "dashboard_start_selected_sync" : "workshop_start_window_sync");
    return { data: fixture.malformedStart ? { ...payload(), page: null } :
      fixture.missingRunId ? { ...payload(), runId: null } : payload(), error: null };
  } };
  const service = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "dashboard_checkpoint_selected_sync") {
      assert.equal(args.phase, saved.phase);
      assert.equal(args.page, saved.page);
      for (const id of args.candidate_ids as string[]) candidates.set(id, candidates.get(id) ?? "pending");
      if (args.has_more) saved.page += 1;
      else { saved.phase = saved.phase === "starts_at" && scope === "selected_period" ? "stops_at" : "reconcile"; saved.page = 1; }
      return { data: { ok: true }, error: null };
    }
    if (name === "dashboard_selected_sync_work") {
      return { data: { ok: true, ids: [...candidates].filter(([, status]) => status !== "succeeded").slice(0, 10).map(([id]) => id) }, error: null };
    }
    if (name === "dashboard_record_selected_result") {
      candidates.set(String(args.booqable_order_id), args.ok ? "succeeded" : "failed");
      return { data: { ok: true }, error: null };
    }
    if (name === "dashboard_finish_selected_sync") {
      if (fixture.finishError) return { data: null, error: new Error("finish unavailable") };
      if (args.listing_error || [...candidates.values()].includes("failed")) saved.state = "failed";
      else if (saved.phase === "reconcile" && [...candidates.values()].every((v) => v === "succeeded")) saved.state = "succeeded";
      return { data: payload(), error: null };
    }
    return { data: { ok: true }, error: null };
  } };
  const code = ts.transpileModule(readFileSync(join(process.cwd(), "src/lib/workshop/application/manual-sync.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "@/src/lib/booqable/fetch-source-snapshot") return {
      fetchSelectedPeriodOrderListPage: async (direction: string, page: number, from: string, to: string) => {
        fetched.push({ direction, page, from, to });
        return fixture.pages?.[`${direction}:${page}`] ?? { orders: [], hasMore: false };
      },
      fetchWorkshopWindowOrderListPage: async (page: number, from: string, to: string) => {
        fetched.push({ direction: "starts_at", page, from, to });
        return fixture.pages?.[`starts_at:${page}`] ?? { orders: [], hasMore: false };
      },
    };
    if (id === "@/src/lib/dashboard/period") return { resolveDashboardPeriod };
    if (id === "@/src/lib/workshop/domain/commands") return { selectedPeriodEligible };
    if (id === "@/src/lib/workshop/domain") return { parseWorkshopSyncResult: (value: Record<string, unknown>) =>
      value.ok === true && typeof value.runId !== "string"
        ? { ok: false, code: "SOURCE_UNAVAILABLE", error: "Invalid saved refresh state." } : value };
    if (id === "./reconcile-order") return {
      createServiceRoleClient: () => { if (fixture.serviceError) throw new Error("service unavailable"); return service; },
      coerceLeaseFence: (value: unknown) => typeof value === "number" ? value : null,
      MANUAL_LOCK_KEY: "manual_sync", ORDER_LEASE_TTL_MS: 120000,
      startLeaseRenewLoop: () => () => {},
      reconcileBooqableOrder: async (id: string) => fixture.reconcile?.(id) ?? { ok: true },
    };
    if (id === "./sync-env") return { workshopSyncAllowed: () => fixture.allowed !== false };
    return testRequire(id);
  }, module, module.exports);
  return {
    start: module.exports.runSelectedPeriodStart as (client: unknown, from: string, to: string) => Promise<Record<string, unknown>>,
    resume: module.exports.runSelectedPeriodResume as (client: unknown, id: string) => Promise<Record<string, unknown>>,
    workshopStart: module.exports.runManualSyncStart as (client: unknown, scope: string) => Promise<Record<string, unknown>>,
    workshopResume: module.exports.runManualSyncResume as (client: unknown, id: string) => Promise<Record<string, unknown>>,
    user, calls, fetched, candidates, saved,
  };
}

function selectedOrder(id: string, field: "startsAt" | "stopsAt" = "startsAt") {
  return { id, status: "reserved", startsAt: field === "startsAt" ? "2026-10-25T08:00:00Z" : null,
    stopsAt: field === "stopsAt" ? "2026-10-25T08:00:00Z" : null };
}

test("selected worker discovers return pages, resumes saved bounds, and continues ten at a time", async () => {
  const orders = Array.from({ length: 12 }, (_, i) => selectedOrder(`return-${i}`, "stopsAt"));
  const worker = selectedWorker({ pages: {
    "starts_at:1": { orders: [], hasMore: false },
    "stops_at:1": { orders: orders.slice(0, 6), hasMore: true },
    "stops_at:2": { orders: orders.slice(6), hasMore: false },
  } });
  let result = await worker.start(worker.user, "2026-10-25", "2026-10-25");
  for (let i = 0; i < 3; i += 1) result = await worker.resume(worker.user, selectedRunId);
  assert.equal(result.state, "in_progress");
  result = await worker.resume(worker.user, selectedRunId);
  assert.equal(result.state, "succeeded", JSON.stringify(result));
  assert.equal(worker.candidates.size, 12);
  assert.deepEqual(worker.fetched.map((v) => `${v.direction}:${v.page}`), ["starts_at:1", "stops_at:1", "stops_at:2"]);
  assert.ok(worker.fetched.every((v) => v.from === worker.saved.from && v.to === worker.saved.to));
  assert.equal(worker.calls.filter((v) => v.name === "dashboard_record_selected_result").length, 12);
});

test("selected worker fails closed on mixed malformed list before checkpointing valid candidate", async () => {
  const worker = selectedWorker({ pages: { "starts_at:1": {
    orders: [selectedOrder("valid"), { ...selectedOrder("malformed"), status: null }], hasMore: false,
  } } });
  const result = await worker.start(worker.user, "2026-10-25", "2026-10-25");
  assert.equal(result.state, "failed");
  assert.equal(worker.candidates.size, 0);
  assert.equal(worker.calls.filter((v) => v.name === "dashboard_checkpoint_selected_sync").length, 0);
});

test("selected worker retries failed result and saves setup/finalization failures", async () => {
  let fail = true;
  const worker = selectedWorker({ pages: { "starts_at:1": { orders: [selectedOrder("retry")], hasMore: false } },
    reconcile: () => fail ? { ok: false, code: "SOURCE_UNAVAILABLE", error: "source down" } : { ok: true } });
  await worker.start(worker.user, "2026-10-25", "2026-10-25");
  await worker.resume(worker.user, selectedRunId);
  await worker.resume(worker.user, selectedRunId);
  assert.equal((await worker.resume(worker.user, selectedRunId)).state, "failed");
  fail = false;
  assert.equal((await worker.resume(worker.user, selectedRunId)).state, "succeeded");
  for (const fixture of [{ serviceError: true }, { malformedStart: true }, { missingRunId: true }, { finishError: true }]) {
    const broken = selectedWorker(fixture);
    assert.equal((await broken.start(broken.user, "2026-10-25", "2026-10-25")).ok, false);
    assert.equal(broken.saved.state, "failed");
    assert.ok(broken.calls.some((v) => v.name === "dashboard_abort_selected_sync"));
  }
});

test("disabled selected sync never starts or resumes a lease", async () => {
  const worker = selectedWorker({ allowed: false });
  assert.equal((await worker.start(worker.user, "2026-10-25", "2026-10-25")).ok, false);
  assert.equal((await worker.resume(worker.user, selectedRunId)).ok, false);
  assert.equal(worker.calls.length, 0);
});

test("Workshop worker saves two discovery pages, ignores unrelated rows, and resumes in ten-order chunks", async () => {
  const orders = Array.from({ length: 12 }, (_, i) => selectedOrder(`workshop-${i}`));
  const worker = selectedWorker({ scope: "next_7_days", pages: {
    "starts_at:1": { orders: [...orders.slice(0, 6), { ...selectedOrder("started"), status: "started" }], hasMore: true },
    "starts_at:2": { orders: [...orders.slice(6), { ...selectedOrder("outside"), startsAt: "2026-11-01T08:00:00Z" }], hasMore: false },
  } });
  let result = await worker.workshopStart(worker.user, "next_7_days");
  for (let i = 0; i < 3; i += 1) result = await worker.workshopResume(worker.user, selectedRunId);
  assert.equal(result.state, "succeeded", JSON.stringify(result));
  assert.equal(worker.candidates.size, 12);
  assert.deepEqual(worker.fetched.map((v) => `${v.direction}:${v.page}`), ["starts_at:1", "starts_at:2"]);
  assert.ok(worker.fetched.every((v) => v.from === worker.saved.from && v.to === worker.saved.to));
  assert.equal(worker.calls.filter((v) => v.name === "dashboard_record_selected_result").length, 12);
  assert.equal(worker.calls.filter((v) => v.name === "dashboard_checkpoint_selected_sync").length, 2);
});

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(path));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

const FORBIDDEN_DOMAIN_IMPORT =
  /(?:from\s+["'](?:next(?:\/|$)|@supabase\/)|import\(["'](?:next(?:\/|$)|@supabase\/)|from\s+["'][^"']*booqable[^"']*["']|import\(["'][^"']*booqable[^"']*["'])/;

const FORBIDDEN_UI_APPLICATION =
  /from\s+["']@\/src\/lib\/workshop\/application(?:\/|$)|from\s+["']\.\.\/.*application/;

test("workshopSyncAllowed is false on preview and staging git ref", () => {
  assert.equal(workshopSyncAllowed({}), true);
  assert.equal(workshopSyncAllowed({ VERCEL_ENV: "production" }), true);
  assert.equal(
    workshopSyncAllowed({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
    }),
    true,
  );
  assert.equal(workshopSyncAllowed({ VERCEL_ENV: "preview" }), false);
  assert.equal(
    workshopSyncAllowed({ VERCEL_GIT_COMMIT_REF: "staging" }),
    false,
  );
});

test("sandboxBackfillAllowed is true only when VERCEL_ENV is unset", () => {
  assert.equal(sandboxBackfillAllowed({}), true);
  assert.equal(sandboxBackfillAllowed({ VERCEL_ENV: "" }), true);
  assert.equal(sandboxBackfillAllowed({ VERCEL_ENV: "production" }), false);
  assert.equal(sandboxBackfillAllowed({ VERCEL_ENV: "preview" }), false);
});

test("customer webhook dest writes are off on localhost unless overridden", () => {
  assert.equal(customerWebhookDestWritesAllowed({}), false);
  assert.equal(customerWebhookDestWritesAllowed({ VERCEL_ENV: "" }), false);
  assert.equal(
    customerWebhookDestWritesAllowed({ VERCEL_ENV: "production" }),
    true,
  );
  assert.equal(customerWebhookDestWritesAllowed({ VERCEL_ENV: "preview" }), false);
  assert.equal(
    customerWebhookDestWritesAllowed({ VERCEL_GIT_COMMIT_REF: "staging" }),
    false,
  );
  assert.equal(
    customerWebhookDestWritesAllowed({ CUSTOMER_WEBHOOK_DEST_WRITES: "1" }),
    true,
  );
  assert.equal(
    customerWebhookDestWritesAllowed({
      VERCEL_ENV: "preview",
      CUSTOMER_WEBHOOK_DEST_WRITES: "1",
    }),
    false,
  );
});

test("webhook signal uses only data[id]", () => {
  assert.equal(
    parseBooqableWebhookOrderId("data[id]=order-344&data[status]=new&data[number]="),
    "order-344",
  );
  assert.equal(parseBooqableWebhookOrderId("data[status]=reserved&data[number]=344"), null);
  assert.equal(parseBooqableWebhookOrderId(""), null);
  assert.equal(parseBooqableWebhookOrderId("data[id]="), null);
  assert.equal(
    parseBooqableWebhookOrderId("data[id]=%20order-344%20"),
    "order-344",
  );

  const webhook = readSrc("app/api/webhooks/booqable/route.ts");
  assert.match(webhook, /dispatchBooqableWebhookEvent/);
  assert.doesNotMatch(webhook, /data\[status\]/);
  assert.doesNotMatch(webhook, /data\[number\]/);
  assert.doesNotMatch(webhook, /Provided secret/);
  assert.doesNotMatch(webhook, /secret: \$\{/);
  assert.match(webhook, /workshopSyncAllowed/);
  assert.match(webhook, /reconcileBooqableOrder/);
  assert.match(webhook, /dispatchBooqableWebhookEvent/);
  assert.match(webhook, /landBooqableCustomer/);
  assert.match(webhook, /tagReviewRequestForOrder/);
});

test("webhook event classify is fail-closed", () => {
  assert.equal(
    classifyBooqableWebhookEvent("event=order.reserved&data[id]=order-344"),
    "order",
  );
  assert.equal(
    classifyBooqableWebhookEvent("event=order.stopped&data[id]=order-344"),
    "order",
  );
  assert.equal(
    classifyBooqableWebhookEvent("event=customer.created&data[id]=cust-X"),
    "customer",
  );
  assert.equal(
    classifyBooqableWebhookEvent("event=customer.updated&data[id]=cust-X"),
    "customer",
  );
  assert.equal(classifyBooqableWebhookEvent("data[id]=cust-X"), "ignore");
  assert.equal(classifyBooqableWebhookEvent("event=foo&data[id]=cust-X"), "ignore");
  assert.equal(
    classifyBooqableWebhookEvent("event=customer.deleted&data[id]=cust-X"),
    "ignore",
  );

  const webhook = readSrc("app/api/webhooks/booqable/route.ts");
  assert.match(webhook, /dispatchBooqableWebhookEvent/);
  assert.match(webhook, /landBooqableCustomer/);
  assert.match(webhook, /reconcileBooqableOrder/);
  const dispatch = readSrc("lib/workshop/application/sync-env.ts");
  assert.match(dispatch, /customerWebhookDestWritesAllowed/);
  assert.match(dispatch, /order\.stopped/);
  assert.match(dispatch, /tagReviewRequest/);
  const reconcile = readSrc("lib/workshop/application/reconcile-order.ts");
  assert.doesNotMatch(reconcile, /review-request|tagReviewRequest/);
});

test("webhook dispatch executes fail-closed routing", async () => {
  const lands: string[] = [];
  const reconciles: string[] = [];
  const green = {
    google: { status: "green", error: null },
    holded: { status: "green", error: null },
    mailchimp: { status: "green", error: null },
  };
  const tags: string[] = [];
  const handlers = {
    async landCustomer(id: string) {
      lands.push(id);
      return { ok: true as const, ignored: false as const, statuses: green };
    },
    async reconcileOrder(id: string) {
      reconciles.push(id);
      return { ok: true };
    },
    async tagReviewRequest(id: string) {
      tags.push(id);
    },
  };

  const ignored = await dispatchBooqableWebhookEvent(
    "event=foo&data[id]=cust-X",
    handlers,
  );
  assert.equal(ignored.status, 200);
  assert.deepEqual(ignored.json, { received: true });
  assert.equal(ignored.ignoreEvent, "foo");
  assert.deepEqual(lands, []);
  assert.deepEqual(reconciles, []);

  const missing = await dispatchBooqableWebhookEvent("data[id]=cust-X", handlers);
  assert.equal(missing.status, 200);
  assert.deepEqual(missing.json, { received: true });
  assert.equal(missing.ignoreEvent, "(missing)");
  assert.deepEqual(lands, []);
  assert.deepEqual(reconciles, []);

  const customerLocal = await dispatchBooqableWebhookEvent(
    "event=customer.created&data[id]=cust-local",
    handlers,
    {},
  );
  assert.equal(customerLocal.status, 200);
  assert.deepEqual(customerLocal.json, { received: true });
  assert.equal(customerLocal.ignoreEvent, "customer dest writes disabled");
  assert.deepEqual(lands, []);
  assert.deepEqual(reconciles, []);

  const customerOverride = await dispatchBooqableWebhookEvent(
    "event=customer.updated&data[id]=cust-override",
    handlers,
    { CUSTOMER_WEBHOOK_DEST_WRITES: "1" },
  );
  assert.equal(customerOverride.status, 200);
  assert.deepEqual(lands, ["cust-override"]);

  const customer = await dispatchBooqableWebhookEvent(
    "event=customer.created&data[id]=cust-X",
    handlers,
    { VERCEL_ENV: "production" },
  );
  assert.equal(customer.status, 200);
  assert.deepEqual(customer.json, { received: true });
  assert.deepEqual(lands, ["cust-override", "cust-X"]);
  assert.deepEqual(reconciles, []);

  const landFail = await dispatchBooqableWebhookEvent(
    "event=customer.updated&data[id]=cust-Y",
    {
      ...handlers,
      async landCustomer(id: string) {
        lands.push(id);
        return { ok: false, error: "GET failed" };
      },
    },
    { VERCEL_ENV: "production" },
  );
  assert.equal(landFail.status, 500);
  assert.deepEqual(landFail.json, {
    error: "Failed to process webhook",
    message: "GET failed",
  });
  assert.deepEqual(reconciles, []);

  const order = await dispatchBooqableWebhookEvent(
    "event=order.reserved&data[id]=order-344",
    handlers,
  );
  assert.equal(order.status, 200);
  assert.deepEqual(reconciles, ["order-344"]);
  assert.deepEqual(lands, ["cust-override", "cust-X", "cust-Y"]);
  assert.deepEqual(tags, []);

  const reservedDestOn = await dispatchBooqableWebhookEvent(
    "event=order.reserved&data[id]=order-reserved-prod",
    handlers,
    { VERCEL_ENV: "production" },
  );
  assert.equal(reservedDestOn.status, 200);
  assert.deepEqual(tags, []);

  const stoppedLocal = await dispatchBooqableWebhookEvent(
    "event=order.stopped&data[id]=order-stopped-local",
    handlers,
    {},
  );
  assert.equal(stoppedLocal.status, 200);
  assert.deepEqual(reconciles, [
    "order-344",
    "order-reserved-prod",
    "order-stopped-local",
  ]);
  assert.deepEqual(tags, []);

  const stopped = await dispatchBooqableWebhookEvent(
    "event=order.stopped&data[id]=order-stopped",
    handlers,
    { VERCEL_ENV: "production" },
  );
  assert.equal(stopped.status, 200);
  assert.deepEqual(tags, ["order-stopped"]);

  const taggerThrow = await dispatchBooqableWebhookEvent(
    "event=order.stopped&data[id]=order-tag-throw",
    {
      ...handlers,
      async tagReviewRequest() {
        throw new Error("mailchimp down");
      },
    },
    { VERCEL_ENV: "production" },
  );
  assert.equal(taggerThrow.status, 200);
  assert.deepEqual(taggerThrow.json, { received: true });
  assert.equal(reconciles.includes("order-tag-throw"), true);

  const delayedTags: string[] = [];
  const delayed = await dispatchBooqableWebhookEvent(
    "event=order.stopped&data[id]=order-delayed-tag",
    {
      ...handlers,
      async tagReviewRequest(id: string) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        delayedTags.push(id);
      },
    },
    { VERCEL_ENV: "production" },
  );
  assert.equal(delayed.status, 200);
  assert.deepEqual(delayedTags, ["order-delayed-tag"]);

  const reconcileFail = await dispatchBooqableWebhookEvent(
    "event=order.stopped&data[id]=order-reconcile-fail",
    {
      ...handlers,
      async reconcileOrder(id: string) {
        reconciles.push(id);
        return { ok: false, code: "SOURCE_UNAVAILABLE", error: "apply failed" };
      },
    },
    { VERCEL_ENV: "production" },
  );
  assert.equal(reconcileFail.status, 500);
  assert.deepEqual(tags, ["order-stopped", "order-reconcile-fail"]);
});

test("fetch include is the complete source snapshot path", () => {
  assert.equal(
    SOURCE_ORDER_INCLUDE,
    "customer,coupon,lines,lines.planning,lines.planning.stock_item_plannings,lines.planning.stock_item_plannings.stock_item,lines.item",
  );
});

test("paginationNextUrl follows strings and href objects, rejects malformed next", () => {
  assert.equal(paginationNextUrl(null, "https://example.test/page/1"), null);
  assert.equal(
    paginationNextUrl(
      { next: "https://example.test/page/2" },
      "https://example.test/page/1",
    ),
    "https://example.test/page/2",
  );
  assert.equal(
    paginationNextUrl(
      { next: { href: "/page/2" } },
      "https://example.test/page/1",
    ),
    "https://example.test/page/2",
  );
  assert.throws(() => paginationNextUrl({ next: { rel: "next" } }, "https://example.test/"));
  assert.throws(
    () =>
      paginationNextUrl(
        { next: "https://evil.test/page/2" },
        "https://example.test/page/1",
      ),
    /INVALID_SNAPSHOT/,
  );
});

test("next 7 days scope accepts only reserved starts in the Madrid window", () => {
  const now = new Date("2026-08-22T12:00:00Z");
  const inWindow = {
    id: "near",
    status: "reserved",
    number: 1,
    startsAt: "2026-08-24T10:00:00+02:00",
  };
  const later = {
    id: "later",
    status: "reserved",
    number: 2,
    startsAt: "2026-09-10T10:00:00+02:00",
  };
  assert.equal(isEligibleManualSyncOrder(inWindow, "next_7_days", now), true);
  assert.equal(isEligibleManualSyncOrder(later, "next_7_days", now), false);
  assert.equal(
    isEligibleManualSyncOrder({ ...inWindow, status: "started" }, "next_7_days", now),
    false,
  );
  assert.equal(skipReason(later, "next_7_days", now), "outside next 7 days");
  assert.equal(skipReason({ ...inWindow, status: "started" }, "next_7_days", now), "skipped non-reserved status");
  assert.equal(skipReason(inWindow, "next_7_days", now), null);

  assert.equal(decodeSyncCursor(Buffer.from(JSON.stringify({ v: 1, scope: "all_reserved", page: 1, runId: "x" })).toString("base64url")), null);
});

test("opaque sync cursor carries versioned scope and page", () => {
  const encoded = encodeSyncCursor({
    v: 1,
    scope: "next_7_days",
    page: 2,
    runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  });
  const decoded = decodeSyncCursor(encoded);
  assert.equal(decoded?.v, 1);
  assert.equal(decoded?.scope, "next_7_days");
  assert.equal(decoded?.page, 2);
  assert.equal(decoded?.runId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(
    decodeSyncCursor(
      Buffer.from(
        JSON.stringify({
          v: 2,
          scope: "next_7_days",
          page: 2,
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        "utf8",
      ).toString("base64url"),
    ),
    null,
  );
  assert.equal(
    decodeSyncCursor(
      Buffer.from(
        JSON.stringify({
          v: 1,
          scope: "yesterday",
          page: 2,
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        "utf8",
      ).toString("base64url"),
    ),
    null,
  );
  assert.equal(
    decodeSyncCursor(
      Buffer.from(
        JSON.stringify({
          v: 1,
          scope: "next_7_days",
          page: 0,
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        "utf8",
      ).toString("base64url"),
    ),
    null,
  );
});

test("src has no leftover dual-write order sync helpers", () => {
  const oldWriter = ["sync", "Booqable", "Order"].join("");
  const oldFetch = ["fetch", "Booqable", "Order"].join("");
  for (const file of collectTsFiles(srcRoot)) {
    if (file.endsWith("workshop-sync.test.mts")) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(
      source.includes(oldWriter) || source.includes(oldFetch),
      false,
      `${file} must not call the old sync writer`,
    );
  }
});

test("workshop domain imports neither Next.js, Supabase, nor Booqable", () => {
  const domainDir = join(srcRoot, "lib/workshop/domain");
  for (const file of collectTsFiles(domainDir)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      FORBIDDEN_DOMAIN_IMPORT,
      `${file} must not import Next.js, Supabase, or Booqable`,
    );
  }
});

test("workshop UI does not import the application layer", () => {
  const uiDir = join(srcRoot, "app/workshop");
  for (const file of collectTsFiles(uiDir)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      FORBIDDEN_UI_APPLICATION,
      `${file} must not import workshop application`,
    );
    assert.doesNotMatch(source, /from\s+["']@\/src\/lib\/booqable/);
  }
});

test("workshop public index does not export application", () => {
  const source = readSrc("lib/workshop/index.ts");
  assert.match(source, /export \* as workshopActions/);
  assert.match(source, /export \* as workshopData/);
  assert.match(source, /export \* as workshopDomain/);
  assert.doesNotMatch(source, /application/);
});

test("sandbox reseed stays on the new reconciler and requires a session", () => {
  const source = readSrc("app/api/sandbox/booqable/sync-orders/route.ts");
  assert.match(source, /sandboxBackfillAllowed/);
  assert.match(source, /get_user_role/);
  assert.match(source, /reconcileBooqableOrder/);
  assert.match(source, /trigger === "sandbox"|\"sandbox\"/);
  assert.doesNotMatch(source, new RegExp(["sync", "Booqable", "Order"].join("")));
  assert.match(source, /getUser\(/);
});

test("task page exposes a large Sync order from Booqable control", () => {
  const source = readSrc("app/workshop/_components/WorkshopTask.tsx");
  assert.match(source, /Sync order details from Booqable/);
  assert.match(source, /syncOrderFromBooqable/);
  assert.match(source, /tabletMode \? "large" : "medium"/);
});

test("workshop queue exposes next 7 days sync", () => {
  const source = readSrc("app/workshop/_components/WorkshopQueue.tsx");
  assert.match(source, /Sync next 7 days/);
  assert.doesNotMatch(source, /Sync all reserved/);
  assert.match(source, /startManualSync/);
  assert.match(source, /resumeManualSync\(result.runId\)/);
  assert.match(source, /booqable_sync_runs/);
  assert.match(source, /Last successful seven-day sync/);
});

test("next 7 days uses shared bounded worker and run-id continuation", () => {
  const manual = readSrc("lib/workshop/application/manual-sync.ts");
  const queue = readSrc("app/workshop/_components/WorkshopQueue.tsx");

  assert.match(manual, /workshop_start_window_sync/);
  assert.match(manual, /workshop_resume_window_sync/);
  assert.match(manual, /fetchWorkshopWindowOrderListPage/);
  assert.match(manual, /dashboard_checkpoint_selected_sync/);
  assert.match(manual, /startLeaseRenewLoop/);
  assert.doesNotMatch(manual, /walkNext7DaysReservedPages/);
  assert.match(queue, /resumeManualSync\(result.runId\)/);
  assert.match(queue, /WORKSHOP_QUEUE_REALTIME_REFRESH_MS/);
});

test("webhook maps busy to 200 and other reconcile failures to 500", () => {
  assert.deepEqual(webhookDeliveryStatus({ allowed: false }), {
    status: 200,
    ignored: true,
  });
  assert.deepEqual(
    webhookDeliveryStatus({
      allowed: true,
      result: { ok: false, code: "SYNC_IN_PROGRESS" },
    }),
    { status: 200, ignored: false },
  );
  assert.deepEqual(
    webhookDeliveryStatus({
      allowed: true,
      result: { ok: false, code: "SOURCE_UNAVAILABLE" },
    }),
    { status: 500, ignored: false },
  );
  assert.deepEqual(webhookDeliveryStatus({ allowed: true, result: { ok: true } }), {
    status: 200,
    ignored: false,
  });

  const webhook = readSrc("app/api/webhooks/booqable/route.ts");
  assert.match(webhook, /webhookDeliveryStatus/);
  assert.match(webhook, /status: 401/);
  assert.match(webhook, /Unauthorized webhook attempt/);
  assert.match(webhook, /ignored: true/);
});

test("list sync fetches one reserved page of 50 and retries Retry-After", () => {
  const source = readSrc("lib/booqable/fetch-source-snapshot.ts");
  assert.match(source, /const LIST_PAGE_SIZE = 50/);
  assert.match(source, /const MAX_ATTEMPTS = 3/);
  assert.match(source, /filter\[status\]": "reserved"/);
  assert.match(source, /Retry-After/);
  assert.match(source, /page\[size\]/);
});

test("staff sync and per-task sync share reconcile and gate preview", () => {
  const manual = readSrc("lib/workshop/application/manual-sync.ts");
  const reconcile = readSrc("lib/workshop/application/reconcile-order.ts");
  assert.match(manual, /workshopSyncAllowed\(\)/);
  assert.match(manual, /SOURCE_UNAVAILABLE/);
  assert.match(manual, /reconcileBooqableOrder\(booqableOrderId, "task"/);
  assert.match(manual, /reconcileBooqableOrder\(id, "manual"/);
  assert.match(reconcile, /trigger === "sandbox"/);
  assert.match(reconcile, /snapshot\.sourceStatus === "reserved"/);
  assert.match(reconcile, /booqable_release_order_lease/);
  assert.match(reconcile, /ORDER_LEASE_TTL_MS = 2 \* 60 \* 1000/);
});

test("sandbox denies mechanic and partner and redirects anonymous", () => {
  const source = readSrc("app/api/sandbox/booqable/sync-orders/route.ts");
  assert.match(
    source,
    /redirect\("\/login\?next=\/api\/sandbox\/booqable\/sync-orders"\)/,
  );
  assert.match(source, /role !== "admin" && role !== "manager"/);
  assert.match(source, /code: "FORBIDDEN"/);
  assert.match(source, /sandboxBackfillAllowed/);
  assert.match(source, /fetchAllOrdersListPage/);
});

test("list document rejects missing data, bad rows, and empty pages with next", () => {
  const current = "https://example.test/api/4/orders?page=1";
  const row = {
    id: "ord-1",
    attributes: { status: "reserved", number: 1, starts_at: "2026-08-24T10:00:00Z" },
  };
  assert.deepEqual(parseOrderListDocument({ data: [row] }, current).orders[0]?.id, "ord-1");
  assert.throws(() => parseOrderListDocument({ data: { id: "ord-1" } }, current));
  assert.throws(() => parseOrderListDocument({ data: [{ attributes: {} }] }, current));
  assert.throws(() => parseOrderListDocument({ data: [row], included: {} }, current));
  assert.throws(() =>
    parseOrderListDocument(
      { data: [], links: { next: "https://example.test/api/4/orders?page=2" } },
      current,
    ),
  );
});

test("task page keeps Sync on the cancelled tombstone and shows inline errors", () => {
  const source = readSrc("app/workshop/_components/WorkshopTask.tsx");
  assert.match(source, /isTombstone = task\.status === "cancelled"/);
  assert.match(source, /\{syncButton\}/);
  assert.match(source, /commandError \?/);
  assert.match(source, /variant="error"/);
});
