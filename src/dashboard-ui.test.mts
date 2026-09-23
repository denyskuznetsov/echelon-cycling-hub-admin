import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const nodeRequire = createRequire(import.meta.url);

function loadDeliveryComponents(): Record<string, unknown> {
  const code = ts.transpileModule(read("src/app/dashboard/_components/DashboardWorkload.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react" || id === "react/jsx-runtime") return nodeRequire(id);
    if (id.endsWith(".module.css")) return { default: new Proxy({}, { get: (_target, key) => String(key) }) };
    if (id === "@subframe/core") return { FeatherMapPin: () => React.createElement("span") };
    return {};
  }, module, module.exports);
  return module.exports;
}

function loadSyncComponent(mocks?: {
  buttons?: { label: string; onClick?: () => Promise<void>; disabled?: boolean }[];
  start?: (from: string, to: string) => Promise<unknown>;
  resume?: (id: string) => Promise<unknown>;
  refresh?: () => void;
}): React.ComponentType<{ period: unknown; health: unknown; allowed: boolean; recoverableRuns: unknown[]; healthError: string | null }> {
  const code = ts.transpileModule(read("src/app/dashboard/_components/DashboardSync.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react" || id === "react/jsx-runtime") return nodeRequire(id);
    if (id === "next/navigation") return { useRouter: () => ({ refresh: mocks?.refresh ?? (() => {}) }) };
    if (id === "@/src/lib/workshop/actions/sync-actions") return {
      startSelectedPeriodSync: mocks?.start ?? (async () => ({ ok: true, runId: "new", state: "succeeded" })),
      resumeSelectedPeriodSync: mocks?.resume ?? (async () => ({ ok: true, runId: "new", state: "succeeded" })),
    };
    if (id === "@/ui/components/Button") return { Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      mocks?.buttons?.push({ label: String(children), onClick: props.onClick as () => Promise<void>, disabled: props.disabled as boolean });
      return React.createElement("button", { disabled: props.disabled as boolean }, children);
    } };
    return {};
  }, module, module.exports);
  return module.exports.DashboardSync as React.ComponentType<{ period: unknown; health: unknown; allowed: boolean; recoverableRuns: unknown[]; healthError: string | null }>;
}

test("selected refresh renders empty, incomplete, failed, and saved-range states without hiding workload", () => {
  const DashboardSync = loadSyncComponent();
  const period = { from: "2026-10-25", to: "2026-10-25", error: null };
  const render = (health: unknown, allowed = true, healthError: string | null = null) => renderToStaticMarkup(React.createElement(DashboardSync, { period, health, recoverableRuns: [], healthError, allowed }));
  assert.match(render(null), /Not refreshed/);
  assert.match(render(null), /Refresh selected dates/);
  const base = {
    runId: "a", fromDate: "2026-10-20", toDate: "2026-10-22",
    phase: "stops_at", page: 3, counts: { listed: 4, succeeded: 2, failed: 1, skipped: 0 },
    lastError: "Source unavailable", lastAttemptAt: "2026-10-20T12:00:00Z", finishedAt: null,
  };
  assert.match(render({ ...base, state: "in_progress" }), /Refresh incomplete/);
  const failed = render({ ...base, state: "failed" });
  assert.match(failed, /Partial sync failed/);
  assert.match(failed, /Latest saved refresh: 2026-10-20 to 2026-10-22/);
  assert.match(failed, /viewing 2026-10-25 to 2026-10-25/);
  assert.match(failed, /Checked 20 Oct 2026/);
  assert.match(failed, /Source unavailable/);
  assert.match(failed, /Resume refresh/);
  assert.match(render({ ...base, state: "succeeded", lastError: null }), /Sync complete/);
  assert.match(render(null, false), /unavailable in this environment/);
  assert.match(render(null, true, "read failed"), /Refresh progress unavailable/);
  const workload = read("src/app/dashboard/_components/DashboardWorkload.tsx");
  assert.ok(workload.indexOf("<DashboardSync") < workload.indexOf("<Attention"));
  assert.doesNotMatch(workload, /inert=\{working/);
});

test("selected refresh buttons await each continuation and can resume an older run", async () => {
  const buttons: { label: string; onClick?: () => Promise<void>; disabled?: boolean }[] = [];
  const calls: string[] = [];
  let refreshed = 0;
  const DashboardSync = loadSyncComponent({ buttons,
    start: async (from, to) => { calls.push(`start:${from}:${to}`); return { ok: true, runId: "new", state: "in_progress" }; },
    resume: async (id) => { calls.push(`resume:${id}`); return { ok: true, runId: id, state: calls.length < 3 ? "in_progress" : "succeeded" }; },
    refresh: () => { refreshed += 1; },
  });
  const period = { from: "2026-10-25", to: "2026-10-25", error: null };
  const older = { runId: "old", state: "failed", fromDate: "2026-10-20", toDate: "2026-10-21",
    phase: "reconcile", page: 1, counts: { listed: 1, succeeded: 0, failed: 1, skipped: 0 },
    lastError: "source down", lastAttemptAt: "2026-10-21T12:00:00Z", finishedAt: null };
  renderToStaticMarkup(React.createElement(DashboardSync, {
    period, health: { ...older, runId: "latest", state: "succeeded" }, recoverableRuns: [older], healthError: null, allowed: true,
  }));
  await buttons.find((button) => button.label === "Resume refresh")?.onClick?.();
  assert.deepEqual(calls, ["resume:old", "resume:old", "resume:old"]);
  assert.equal(refreshed, 3);
  calls.length = 0;
  buttons.length = 0;
  renderToStaticMarkup(React.createElement(DashboardSync, { period, health: null, recoverableRuns: [], healthError: null, allowed: true }));
  await buttons.find((button) => button.label === "Refresh selected dates")?.onClick?.();
  assert.deepEqual(calls, ["start:2026-10-25:2026-10-25", "resume:new", "resume:new"]);
  assert.equal(refreshed, 6);
});

test("dashboard keeps invalid dates and workload failures separate", () => {
  const page = read("src/app/dashboard/page.tsx");
  assert.match(page, /Check the selected dates/);
  assert.match(page, /Couldn't load dashboard workload/);
  assert.match(page, /DashboardWorkload/);
});

test("dashboard mobile direction control has tab semantics and keyboard switching", () => {
  const component = read("src/app/dashboard/_components/DashboardWorkload.tsx");
  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tab"/);
  assert.match(component, /aria-selected/);
  assert.match(component, /ArrowLeft/);
  assert.match(component, /ArrowRight/);
  assert.match(component, /nextDirection.*focus/);
  assert.match(component, /aria-labelledby/);
});

test("dashboard places attention before chronological lists", () => {
  const component = read("src/app/dashboard/_components/DashboardWorkload.tsx");
  assert.ok(component.indexOf("<Attention items={workload.attention}") < component.indexOf("<DirectionList direction=\"outgoing\""));
});

test("drive estimates are independent of drawer navigation and workload rendering", () => {
  const component = read("src/app/dashboard/_components/DashboardWorkload.tsx");
  const page = read("src/app/dashboard/page.tsx");
  assert.match(component, /fetchDeliveryEstimates\(batch, priorRouteKeys\)/);
  assert.match(component, /matchingEstimate\(source, result\)/);
  assert.match(component, /if \(!active\) return/);
  assert.match(component, /Drive time unavailable/);
  assert.match(component, /Approx\. .*Google Maps/);
  assert.match(component, /showEstimate=\{row\.fulfillment_type === "delivery"\}/);
  assert.match(component, /\[\.\.\.workload\.outgoing\.days, \.\.\.workload\.incoming\.days\]/);
  assert.match(component, /onClick=\{\(\) => openOrder\(row\.order_id\)\}/);
  assert.match(component, /\}, \[signature\]\);/);
  assert.doesNotMatch(page, /fetchDeliveryEstimates|computeDriveMinutes/);
});

test("rendered drive-time states move from loading to duration or unavailable", () => {
  const { DriveTime } = loadDeliveryComponents() as { DriveTime: React.ComponentType<{ estimate: { minutes: number | null } | null }> };
  const render = (estimate: { minutes: number | null } | null) => renderToStaticMarkup(React.createElement(DriveTime, { estimate }));
  assert.match(render(null), /Checking drive time…/);
  assert.match(render({ minutes: 7 }), /Approx\. 7 min from shop · Google Maps/);
  assert.match(render({ minutes: null }), /Drive time unavailable/);
});

test("rendered unsupported address keeps its text and shows unavailable immediately", () => {
  const { DeliveryDetail } = loadDeliveryComponents() as { DeliveryDetail: React.ComponentType<{ row: unknown; estimate: unknown; showEstimate: boolean }> };
  const row = { delivery_kind: "address", delivery_value: "TBD" };
  const unavailable = { orderId: "a", kind: "address", value: "TBD", minutes: null, routeKey: null };
  const outgoing = renderToStaticMarkup(React.createElement(DeliveryDetail, { row, estimate: unavailable, showEstimate: true }));
  assert.match(outgoing, /TBD/);
  assert.match(outgoing, /Drive time unavailable/);
  assert.doesNotMatch(outgoing, /Checking drive time/);
  const pickup = renderToStaticMarkup(React.createElement(DeliveryDetail, { row, estimate: null, showEstimate: false }));
  assert.match(pickup, /TBD/);
  assert.doesNotMatch(pickup, /drive time/i);
});

test("rendered incoming delivery keeps its address and shows the same shop drive estimate", () => {
  const { DeliveryDetail } = loadDeliveryComponents() as { DeliveryDetail: React.ComponentType<{ row: unknown; estimate: unknown; showEstimate: boolean }> };
  const row = { delivery_kind: "address", delivery_value: "Carretera Lluc, Ma-10, km45 07100 Soller Balears Spain" };
  const incoming = renderToStaticMarkup(React.createElement(DeliveryDetail, {
    row, estimate: { minutes: 42 }, showEstimate: true,
  }));
  assert.match(incoming, /Carretera Lluc, Ma-10, km45 07100 Soller Balears Spain/);
  assert.match(incoming, /Approx\. 42 min from shop · Google Maps/);
});
