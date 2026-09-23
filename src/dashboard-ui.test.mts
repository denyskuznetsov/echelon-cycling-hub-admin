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
