import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

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
