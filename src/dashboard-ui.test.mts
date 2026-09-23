import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { isSafeExternalLink } from "./lib/delivery.ts";

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
    if (id === "@subframe/core") return Object.fromEntries(["FeatherMapPin", "FeatherArrowUpRight", "FeatherArrowDownLeft"].map((key) => [key, () => React.createElement("span")]));
    if (id === "@/src/lib/delivery") return { isSafeExternalLink };
    if (id === "@/ui/components/Badge") return { Badge: ({ children }: React.PropsWithChildren) => React.createElement("span", null, children) };
    return {};
  }, module, module.exports);
  return module.exports;
}

function loadSyncComponent(mocks?: {
  buttons?: { label: string; onClick?: () => Promise<void>; disabled?: boolean }[];
  start?: (from: string, to: string) => Promise<unknown>;
  resume?: (id: string) => Promise<unknown>;
  refresh?: () => void;
  updates?: unknown[];
}): React.ComponentType<{ period: unknown; health: unknown; allowed: boolean; lastSuccessAt: string | null; healthError: string | null }> {
  const code = ts.transpileModule(read("src/app/dashboard/_components/DashboardSync.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...nodeRequire(id), useState: (value: unknown) => {
      const [state, setState] = React.useState(value);
      return [state, (next: unknown) => { mocks?.updates?.push(next); setState(next); }];
    } };
    if (id === "react/jsx-runtime") return nodeRequire(id);
    if (id.endsWith(".module.css")) return { default: {} };
    if (id === "@/ui/components/Dialog") return { Dialog: Object.assign(() => null, { Content: () => null }) };
    if (id === "@/src/components/DataLoadError") return { DataLoadError: ({ message }: { message: string }) => React.createElement("p", { role: "alert" }, message) };
    if (id === "@/ui/components/Loader") return { Loader: () => null };
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
  return module.exports.DashboardSync as React.ComponentType<{ period: unknown; health: unknown; allowed: boolean; lastSuccessAt: string | null; healthError: string | null }>;
}

test("one Sync action renders independent historical success, useful failures and unavailability", () => {
  const DashboardSync = loadSyncComponent();
  const period = { from: "2026-10-25", to: "2026-10-25", error: null };
  const render = (health: unknown, lastSuccessAt: string | null = null, allowed = true, healthError: string | null = null) => renderToStaticMarkup(React.createElement(DashboardSync, { period, health, lastSuccessAt, healthError, allowed }));
  assert.match(render(null), /No successful Dashboard sync yet/);
  assert.equal((render(null).match(/<button/g) ?? []).length, 1);
  const base = { runId: "private-run", state: "failed", lastError: "Source unavailable" };
  const failed = render(base, "2026-10-20T12:00:00Z");
  assert.match(failed, /Last successful Dashboard sync:.*20 Oct 2026, 14:00/);
  assert.match(failed, /Source unavailable/);
  assert.doesNotMatch(failed, /Resume|saved refresh|private-run|candidates|Discovery|matches viewed/);
  assert.match(render({ state: "in_progress" }), /Sync was interrupted/);
  assert.match(render(null, null, false), /unavailable in this environment/);
  assert.match(render(null, null, true, "read failed"), /read failed/);
  assert.doesNotMatch(render(null, null, true, "read failed"), /No successful Dashboard sync yet/);
});

test("Sync awaits multiple saved-run steps and rejects same-tick duplicate clicks", async () => {
  const buttons: { label: string; onClick?: () => Promise<void> }[] = [];
  const calls: string[] = [];
  let refreshed = 0;
  const DashboardSync = loadSyncComponent({ buttons,
    start: async (from, to) => { calls.push(`start:${from}:${to}`); return { ok: true, runId: "saved", state: "in_progress" }; },
    resume: async (id) => { calls.push(`resume:${id}`); return { ok: true, runId: id, state: calls.length < 3 ? "in_progress" : "succeeded" }; },
    refresh: () => { refreshed += 1; },
  });
  renderToStaticMarkup(React.createElement(DashboardSync, {
    period: { from: "2026-10-25", to: "2026-10-25", error: null }, health: null, lastSuccessAt: null, healthError: null, allowed: true,
  }));
  await Promise.all([buttons[0]?.onClick?.(), buttons[0]?.onClick?.()]);
  assert.deepEqual(calls, ["start:2026-10-25:2026-10-25", "resume:saved", "resume:saved"]);
  assert.equal(refreshed, 1);
});

test("terminal failed, action failure and rejected requests release the blocker and can retry", async () => {
  for (const outcome of [{ ok: true, runId: "saved", state: "failed" }, { ok: false, error: "Lease is active" }, new Error("Connection lost")]) {
    const buttons: { label: string; onClick?: () => Promise<void> }[] = [];
    const updates: unknown[] = [];
    let calls = 0;
    const DashboardSync = loadSyncComponent({ buttons, updates, start: async () => { calls++; if (outcome instanceof Error) throw outcome; return outcome; } });
    renderToStaticMarkup(React.createElement(DashboardSync, { period: { from: "2026-10-25", to: "2026-10-25", error: null }, health: null, lastSuccessAt: "2026-10-20T12:00:00Z", healthError: null, allowed: true }));
    await buttons[0]?.onClick?.();
    assert.equal(updates.at(-1), false);
    assert.ok(updates.some((value) => typeof value === "string" && value.length > 0));
    await buttons[0]?.onClick?.();
    assert.equal(calls, 2);
  }
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


test("address navigation preserves exact text and safe selected Maps destinations", () => {
  const { DeliveryDetail } = loadDeliveryComponents() as { DeliveryDetail: React.ComponentType<{ row: unknown; estimate: unknown; showEstimate: boolean }> };
  const render = (kind: string, value: string | null) => renderToStaticMarkup(React.createElement(DeliveryDetail, { row: { delivery_kind: kind, delivery_value: value }, estimate: { minutes: null }, showEstimate: true }));
  const address = "  Carrer d’Àngel 7, Sóller & Port  ";
  const html = render("address", address);
  assert.ok(html.includes(encodeURIComponent(address)));
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Open delivery address in Google Maps:/);
  assert.match(html, /Drive time unavailable/);
  assert.doesNotMatch(render("address", " \n "), /<a /);
  assert.doesNotMatch(render("address", null), /<a /);
  assert.match(render("maps", "https://maps.app.goo.gl/example"), /href="https:\/\/maps.app.goo.gl\/example"/);
  assert.doesNotMatch(render("maps", "javascript:alert(1)"), /<a /);
});

test("readiness appears once while distinct lifecycle facts and zero-task state remain", () => {
  const { TaskBadges } = loadDeliveryComponents() as { TaskBadges: React.ComponentType<{ row: unknown }> };
  const render = (row: unknown) => renderToStaticMarkup(React.createElement(TaskBadges, { row }));
  const ready = render({ task_count: 2, ready_task_count: 2, lifecycle_counts: { ready_for_pickup: 2, to_prepare: 0 } });
  assert.equal((ready.match(/ready for pickup/g) ?? []).length, 1);
  assert.match(ready, /2\/2 ready for pickup/);
  assert.doesNotMatch(ready, /to prepare/);
  const mixed = render({ task_count: 4, ready_task_count: 1, lifecycle_counts: { ready_for_pickup: 1, to_prepare: 1, picked_up: 1, returned: 1 } });
  assert.match(mixed, /1\/4 ready for pickup/);
  for (const status of ["1 to prepare", "1 picked up", "1 returned"]) assert.ok(mixed.includes(status));
  assert.equal(render({ task_count: 0 }), "<span>No Workshop tasks</span>");
});

test("summary hides optional zero counts and retains core zero workload", () => {
  const { Summary } = loadDeliveryComponents() as { Summary: React.ComponentType<{ direction: string; totals: unknown }> };
  const render = (value: number) => renderToStaticMarkup(React.createElement(Summary, { direction: "outgoing", totals: { orders: 0, bikes: 0, deliveries: value, outstanding_preparation: value, missing_delivery_addresses: value } }));
  const zero = render(0);
  assert.match(zero, />0<\/span> orders/);
  assert.match(zero, />0<\/span> bikes/);
  assert.doesNotMatch(zero, /delivery orders|preparation|missing/);
  const positive = render(1);
  assert.match(positive, /1 delivery order/);
  assert.match(positive, /1 bike needs preparation/);
  assert.match(positive, /1 delivery address missing/);
});
