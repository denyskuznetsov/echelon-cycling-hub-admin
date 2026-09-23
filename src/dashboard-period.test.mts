import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardPeriodHref, resolveDashboardPeriod } from "./lib/dashboard/period.ts";

test("today and tomorrow use the Madrid local day at a UTC rollover", () => {
  const reference = new Date("2026-03-29T22:30:00.000Z");
  assert.equal(resolveDashboardPeriod({}, reference).from, "2026-03-30");
  assert.equal(resolveDashboardPeriod({ period: "tomorrow" }, reference).from, "2026-03-31");
});

test("period presets keep local dates over both Madrid DST changes", () => {
  const spring = resolveDashboardPeriod({ period: "next_7_days" }, new Date("2026-03-29T00:30:00.000Z"));
  assert.deepEqual([spring.from, spring.to], ["2026-03-29", "2026-04-04"]);
  const autumn = resolveDashboardPeriod({ period: "next_7_days" }, new Date("2026-10-25T00:30:00.000Z"));
  assert.deepEqual([autumn.from, autumn.to], ["2026-10-25", "2026-10-31"]);
});

test("custom dates reject malformed and reversed ranges", () => {
  assert.match(resolveDashboardPeriod({ period: "custom", from: "2026-02-30", to: "2026-03-01" }).error ?? "", /valid From/);
  assert.match(resolveDashboardPeriod({ period: "custom", from: "2026-04-02", to: "2026-04-01" }).error ?? "", /same as or later/);
});

test("period href preserves the selected order and unrelated URL state", () => {
  const href = buildDashboardPeriodHref(new URLSearchParams("order=11111111-1111-4111-8111-111111111111&source=notice"), { period: "custom", from: "2026-04-01", to: "2026-04-03" });
  assert.equal(href, "/dashboard?order=11111111-1111-4111-8111-111111111111&source=notice&period=custom&from=2026-04-01&to=2026-04-03");
});
