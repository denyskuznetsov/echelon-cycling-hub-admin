import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const nodeRequire = createRequire(import.meta.url);

function loadPresentationalComponent(path: string): Record<string, unknown> {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const requireMock = (id: string): unknown => {
    if (id.endsWith(".module.css")) return { default: new Proxy({}, { get: (_target, key) => String(key) }) };
    if (id === "next/link") return { default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
    if (id === "@/src/components/DataLoadError") return { DataLoadError: ({ title, message }: { title: string; message: string }) => React.createElement("p", { role: "alert" }, `${title}: ${message}`) };
    return nodeRequire(id);
  };
  new Function("require", "module", "exports", code)(requireMock, module, module.exports);
  return module.exports;
}

test("rendered Dashboard notices use exact singular count, text severity and priority order", () => {
  const { OrderNotices, Attention } = loadPresentationalComponent("src/app/dashboard/_components/DashboardNotices.tsx");
  const row = renderToStaticMarkup(React.createElement(OrderNotices as React.ComponentType<{ conditions: unknown[] }>, {
    conditions: [
      { kind: "preparation", severity: "critical", affected_bikes: 1 },
      { kind: "source_reversal", severity: "warning", affected_bikes: 1 },
      { kind: "missing_delivery_address", severity: "low", affected_bikes: 0 },
    ],
  }));
  assert.match(row, /Critical<\/span><span[^>]*>1 bike still to prepare/);
  assert.match(row, /Warning<\/span><span[^>]*>Booqable status moved backward/);
  assert.match(row, /Notice<\/span><span[^>]*>Delivery address missing/);
  assert.ok(row.indexOf("Critical") < row.indexOf("Warning"));
  assert.ok(row.indexOf("Warning") < row.indexOf("Notice"));
  assert.match(row, /border-error-600 bg-error-50/);
  assert.match(row, /border-warning-600 bg-warning-50/);
  assert.match(row, /list-none/);
  assert.match(row, /items-baseline/);
  const attention = renderToStaticMarkup(React.createElement(Attention as React.ComponentType<{ items: unknown[] }>, {
    items: [{ kind: "preparation", severity: "critical", affected_bikes: 2, orders: 1 }],
  }));
  assert.match(attention, /Priority summary/);
  assert.match(attention, /1 priority in this period/);
  assert.match(attention, /2 bikes still to prepare/);
  assert.match(attention, /1 order/);
  const sourceAttention = renderToStaticMarkup(React.createElement(Attention as React.ComponentType<{ items: unknown[] }>, {
    items: [
      { kind: "source_missed_pickup", severity: "warning", affected_bikes: 1, orders: 1 },
      { kind: "source_pickup_ahead", severity: "warning", affected_bikes: 4, orders: 4 },
    ],
  }));
  assert.match(sourceAttention, /Booqable shows return; Workshop has no pickup record.*1 order/s);
  assert.match(sourceAttention, /Booqable shows pickup; Workshop is still preparing.*4 orders/s);
});

test("rendered Workshop task list separates loading, error, empty and stable links", () => {
  const { CurrentWorkshopTaskList } = loadPresentationalComponent("src/components/orders/CurrentWorkshopTaskList.tsx");
  const List = CurrentWorkshopTaskList as React.ComponentType<{ tasks: unknown[]; error: string | null; loading: boolean }>;
  assert.match(renderToStaticMarkup(React.createElement(List, { tasks: [], error: null, loading: true })), /role="status".*Loading Workshop tasks/);
  assert.match(renderToStaticMarkup(React.createElement(List, { tasks: [], error: "Read failed", loading: false })), /role="alert".*Read failed/);
  assert.match(renderToStaticMarkup(React.createElement(List, { tasks: [], error: null, loading: false })), /No current Workshop tasks/);
  const links = renderToStaticMarkup(React.createElement(List, { tasks: [
    { task_id: "11111111-1111-4111-8111-111111111111", bike_display_id: "Bike A", bike_title: null, status: "to_prepare" },
    { task_id: "22222222-2222-4222-8222-222222222222", bike_display_id: "Bike A", bike_title: null, status: "ready_for_pickup" },
  ], error: null, loading: false }));
  assert.match(links, /href="\/workshop\/11111111-1111-4111-8111-111111111111"/);
  assert.match(links, /href="\/workshop\/22222222-2222-4222-8222-222222222222"/);
  assert.match(links, /Task ID 11111111-1111-4111-8111-111111111111/);
  assert.match(links, /Task ID 22222222-2222-4222-8222-222222222222/);
  assert.match(links, /Ready for pickup/);
});

test("selected-order host gates task requests by the loaded staff role and cancels stale responses", () => {
  const host = read("src/components/orders/OrderDetailsDrawerHost.tsx");
  assert.match(host, /if \(!orderId\) return null/);
  assert.match(host, /const isStaff = profile\?\.role === "admin"/);
  assert.match(host, /if \(!isStaff\) return/);
  assert.match(host, /fetchCurrentOrderTasks\(orderId\)/);
  assert.match(host, /if \(cancelled\) return/);
});

test("task action authenticates, authorizes staff and requests only selected order", () => {
  const action = read("src/lib/orders/actions/current-task-actions.ts");
  assert.match(action, /withAuth\("fetchCurrentOrderTasks"/);
  assert.match(action, /\["admin", "manager", "mechanic"\]\.includes\(access\.role\)/);
  assert.match(action, /p_order_id: orderId/);
  assert.match(action, /return \{ tasks: \[\], error:/);
});
