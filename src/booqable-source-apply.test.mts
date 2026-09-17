import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  InvalidSourceSnapshotError,
  parseSourceOrderSnapshot,
} from "./lib/booqable/parse-source-snapshot.ts";
import { SourceOrderSnapshotV1Schema } from "./lib/workshop/domain/source-snapshot.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

function loadFixture(): unknown {
  return JSON.parse(
    readFileSync(
      join(srcRoot, "lib/booqable/fixtures/source-order-snapshot-v1.json"),
      "utf8",
    ),
  );
}

function cloneFixture(): {
  data: {
    id: string;
    type: string;
    relationships?: {
      customer?: { data?: { id: string; type: string } | null };
      lines?: { data?: Array<{ id: string; type: string }> | null };
    };
    attributes?: Record<string, unknown>;
  };
  included: Array<Record<string, unknown>>;
  links?: unknown;
} {
  return JSON.parse(JSON.stringify(loadFixture()));
}

function omitIncluded(payload: { included: Array<Record<string, unknown>> }, id: string) {
  payload.included = payload.included.filter((entry) => entry.id !== id);
}

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(path));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

const FORBIDDEN_IMPORT =
  /from\s+["'](?:next(?:\/|$)|@supabase\/|.*\bbooqable\b)/;

test("fixture parses to SourceOrderSnapshotV1 with identified road assignment", () => {
  const snapshot = parseSourceOrderSnapshot(loadFixture(), "2026-08-21T14:00:00.000Z");
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.fetchedAt, "2026-08-21T14:00:00.000Z");
  assert.equal(snapshot.sourceStatus, "reserved");
  assert.equal(snapshot.order.booqableOrderId, "order-fixture-v1");
  assert.equal(snapshot.order.orderNumber, 344);
  assert.deepEqual(snapshot.order.statuses, ["reserved"]);
  assert.deepEqual(snapshot.order.statusCounts, {
    draft: 0,
    new: 0,
    reserved: 3,
    started: 0,
    stopped: 0,
  });
  assert.equal(snapshot.order.mapsLinkOrder, "https://maps.example.test/order-fixture-v1");
  assert.equal(snapshot.order.partnerPromo, null);
  assert.equal(snapshot.customer?.booqableCustomerId, "customer-fixture-v1");
  assert.equal(snapshot.customer?.birthday, "1990-05-17");
  assert.equal(snapshot.coupon, null);
  assert.equal(snapshot.lines.length, 4);

  const mount = snapshot.lines.find((line) => line.booqableLineId === "line-mount");
  assert.equal(mount?.quantity, 0);

  assert.equal(snapshot.assignments.length, 1);
  const assignment = snapshot.assignments[0];
  assert.equal(assignment.stockItemId, "stock-road-1");
  assert.equal(assignment.sipId, "sip-road-1");
  assert.equal(assignment.booqableLineId, "line-bike");
  assert.equal(assignment.displayId, "RF89RIVXL-2");
  assert.equal(assignment.title, "Focus IZALCO");
  assert.deepEqual(assignment.workshopTags, ["workshop-road-bike"]);
  assert.equal(
    snapshot.assignments.some((row) =>
      row.workshopTags.includes("workshop-road-bike-bundle"),
    ),
    false,
  );
  assert.equal("id" in assignment, false);
  assert.equal(SourceOrderSnapshotV1Schema.safeParse(snapshot).success, true);
});

test("aggregate order fulfillment fields preserve full, mixed, and missing evidence", () => {
  const full = cloneFixture();
  assert.ok(full.data.attributes);
  full.data.attributes.status = "started";
  full.data.attributes.statuses = ["started"];
  full.data.attributes.status_counts = {
    draft: 0,
    new: 0,
    reserved: 0,
    started: 3,
    stopped: 0,
  };
  const fullSnapshot = parseSourceOrderSnapshot(
    full,
    "2026-08-21T14:00:00.000Z",
  );
  assert.deepEqual(fullSnapshot.order.statuses, ["started"]);
  assert.deepEqual(fullSnapshot.order.statusCounts, {
    draft: 0,
    new: 0,
    reserved: 0,
    started: 3,
    stopped: 0,
  });

  const mixed = cloneFixture();
  assert.ok(mixed.data.attributes);
  mixed.data.attributes.status = "started";
  mixed.data.attributes.statuses = ["reserved", "started"];
  mixed.data.attributes.status_counts = {
    draft: 0,
    new: 0,
    reserved: 1,
    started: 2,
    stopped: 0,
  };
  const mixedSnapshot = parseSourceOrderSnapshot(
    mixed,
    "2026-08-21T14:00:00.000Z",
  );
  assert.deepEqual(mixedSnapshot.order.statuses, ["reserved", "started"]);
  assert.equal(mixedSnapshot.order.statusCounts?.reserved, 1);
  assert.equal(mixedSnapshot.order.statusCounts?.started, 2);

  const missing = cloneFixture();
  assert.ok(missing.data.attributes);
  delete missing.data.attributes.statuses;
  delete missing.data.attributes.status_counts;
  const missingSnapshot = parseSourceOrderSnapshot(
    missing,
    "2026-08-21T14:00:00.000Z",
  );
  assert.equal(missingSnapshot.order.statuses, null);
  assert.equal(missingSnapshot.order.statusCounts, null);
});

test("malformed aggregate fulfillment evidence is INVALID_SNAPSHOT", () => {
  const cases: unknown[] = [
    "started",
    ["started", 1],
    [""],
    ["started", "started"],
  ];
  for (const statuses of cases) {
    const payload = cloneFixture();
    assert.ok(payload.data.attributes);
    payload.data.attributes.statuses = statuses;
    assert.throws(
      () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
      InvalidSourceSnapshotError,
    );
  }

  const countCases: unknown[] = [
    [],
    { started: -1 },
    { started: 1.5 },
    { started: "1" },
  ];
  for (const statusCounts of countCases) {
    const payload = cloneFixture();
    assert.ok(payload.data.attributes);
    payload.data.attributes.status_counts = statusCounts;
    assert.throws(
      () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
      InvalidSourceSnapshotError,
    );
  }
});

function addEmptySipLine(
  payload: ReturnType<typeof cloneFixture>,
  opts: {
    lineId: string;
    planningId: string;
    productId: string;
    title: string;
    quantity: number | null;
    tags: string[];
  },
) {
  payload.data.relationships?.lines?.data?.push({
    id: opts.lineId,
    type: "lines",
  });
  payload.included.push({
    id: opts.lineId,
    type: "lines",
    attributes: {
      item_id: opts.productId,
      parent_line_id: null,
      title: opts.title,
      quantity: opts.quantity,
      line_type: "charge",
      position: 5,
      relevant: true,
    },
    relationships: {
      planning: { data: { id: opts.planningId, type: "plannings" } },
      item: { data: { id: opts.productId, type: "products" } },
    },
  });
  payload.included.push({
    id: opts.planningId,
    type: "plannings",
    attributes: {},
    relationships: { stock_item_plannings: { data: [] } },
  });
  payload.included.push({
    id: opts.productId,
    type: "products",
    attributes: { tag_list: opts.tags },
  });
}

test("unidentified sibling is omitted from assignments", () => {
  const payload = cloneFixture();
  addEmptySipLine(payload, {
    lineId: "line-unidentified",
    planningId: "planning-unidentified",
    productId: "product-unidentified",
    title: "Unidentified gravel",
    quantity: 1,
    tags: ["workshop-gravel-bike"],
  });

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  assert.equal(snapshot.assignments.length, 1);
  assert.equal(snapshot.assignments[0].stockItemId, "stock-road-1");
  assert.equal(
    snapshot.lines.some((line) => line.booqableLineId === "line-unidentified"),
    true,
  );
});

test("partner qty 1 empty SIP emits one synthetic assignment", () => {
  const payload = cloneFixture();
  addEmptySipLine(payload, {
    lineId: "line-partner",
    planningId: "planning-partner",
    productId: "product-partner",
    title: "Partner Canyon",
    quantity: 1,
    tags: ["workshop-partner-bike"],
  });

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  const partner = snapshot.assignments.filter((row) =>
    row.stockItemId.startsWith("partner:"),
  );
  assert.equal(partner.length, 1);
  assert.equal(partner[0].stockItemId, "partner:line-partner:1");
  assert.equal(partner[0].sipId, "partner-sip:line-partner:1");
  assert.equal(partner[0].booqableLineId, "line-partner");
  assert.equal(partner[0].displayId, "Partner Bike");
  assert.equal(partner[0].title, "Partner Canyon");
  assert.deepEqual(partner[0].workshopTags, ["workshop-partner-bike"]);
  assert.equal(snapshot.assignments.some((row) => row.stockItemId === "stock-road-1"), true);
});

test("partner qty 2 empty SIP emits two synthetic assignments", () => {
  const payload = cloneFixture();
  addEmptySipLine(payload, {
    lineId: "line-partner",
    planningId: "planning-partner",
    productId: "product-partner",
    title: "Partner Canyon",
    quantity: 2,
    tags: ["workshop-partner-bike"],
  });

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  const partner = snapshot.assignments
    .filter((row) => row.stockItemId.startsWith("partner:"))
    .sort((a, b) => a.stockItemId.localeCompare(b.stockItemId));
  assert.equal(partner.length, 2);
  assert.equal(partner[0].stockItemId, "partner:line-partner:1");
  assert.equal(partner[0].sipId, "partner-sip:line-partner:1");
  assert.equal(partner[1].stockItemId, "partner:line-partner:2");
  assert.equal(partner[1].sipId, "partner-sip:line-partner:2");
  assert.equal(partner[0].displayId, "Partner Bike");
  assert.equal(partner[1].displayId, "Partner Bike");
  assert.equal(partner[0].title, "Partner Canyon");
  assert.equal(partner[1].title, "Partner Canyon");
});

test("partner qty 2→1 keeps :1 and drops :2", () => {
  const qty2 = cloneFixture();
  addEmptySipLine(qty2, {
    lineId: "line-partner",
    planningId: "planning-partner",
    productId: "product-partner",
    title: "Partner Canyon",
    quantity: 2,
    tags: ["workshop-partner-bike"],
  });
  const qty1 = cloneFixture();
  addEmptySipLine(qty1, {
    lineId: "line-partner",
    planningId: "planning-partner",
    productId: "product-partner",
    title: "Partner Canyon",
    quantity: 1,
    tags: ["workshop-partner-bike"],
  });

  const first = parseSourceOrderSnapshot(qty2, "2026-08-21T14:00:00.000Z");
  const second = parseSourceOrderSnapshot(qty1, "2026-08-21T14:00:00.000Z");
  const firstKeys = first.assignments
    .filter((row) => row.stockItemId.startsWith("partner:"))
    .map((row) => row.stockItemId)
    .sort();
  const secondKeys = second.assignments
    .filter((row) => row.stockItemId.startsWith("partner:"))
    .map((row) => row.stockItemId)
    .sort();
  assert.deepEqual(firstKeys, ["partner:line-partner:1", "partner:line-partner:2"]);
  assert.deepEqual(secondKeys, ["partner:line-partner:1"]);
});

test("partner line with no planning still emits a synthetic assignment", () => {
  const payload = cloneFixture();
  payload.data.relationships?.lines?.data?.push({
    id: "line-partner-no-planning",
    type: "lines",
  });
  payload.included.push({
    id: "line-partner-no-planning",
    type: "lines",
    attributes: {
      item_id: "product-partner-no-planning",
      parent_line_id: null,
      title: "Partner Canyon",
      quantity: 1,
      line_type: "charge",
      position: 6,
      relevant: true,
    },
    relationships: {
      item: { data: { id: "product-partner-no-planning", type: "products" } },
    },
  });
  payload.included.push({
    id: "product-partner-no-planning",
    type: "products",
    attributes: { tag_list: ["workshop-partner-bike"] },
  });

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  const partner = snapshot.assignments.filter((row) =>
    row.stockItemId.startsWith("partner:"),
  );
  assert.equal(partner.length, 1);
  assert.equal(partner[0].stockItemId, "partner:line-partner-no-planning:1");
  assert.equal(partner[0].displayId, "Partner Bike");
});

test("partner quantity null emits one unit and quantity 0 emits none", () => {
  const missingQty = cloneFixture();
  addEmptySipLine(missingQty, {
    lineId: "line-partner-null",
    planningId: "planning-partner-null",
    productId: "product-partner-null",
    title: "Partner Canyon",
    quantity: null,
    tags: ["workshop-partner-bike"],
  });
  const zeroQty = cloneFixture();
  addEmptySipLine(zeroQty, {
    lineId: "line-partner-zero",
    planningId: "planning-partner-zero",
    productId: "product-partner-zero",
    title: "Partner Canyon",
    quantity: 0,
    tags: ["workshop-partner-bike"],
  });

  const one = parseSourceOrderSnapshot(missingQty, "2026-08-21T14:00:00.000Z");
  const none = parseSourceOrderSnapshot(zeroQty, "2026-08-21T14:00:00.000Z");
  assert.deepEqual(
    one.assignments
      .filter((row) => row.stockItemId.startsWith("partner:"))
      .map((row) => row.stockItemId),
    ["partner:line-partner-null:1"],
  );
  assert.equal(
    none.assignments.some((row) => row.stockItemId.startsWith("partner:")),
    false,
  );
});

test("partner tag plus another workshop tag does not emit synthetics", () => {
  const payload = cloneFixture();
  addEmptySipLine(payload, {
    lineId: "line-partner-multi",
    planningId: "planning-partner-multi",
    productId: "product-partner-multi",
    title: "Partner Canyon",
    quantity: 1,
    tags: ["workshop-partner-bike", "workshop-road-bike"],
  });

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  assert.equal(
    snapshot.assignments.some((row) => row.stockItemId.startsWith("partner:")),
    false,
  );
});

test("partner-tagged line with SIPs stays on the stock path", () => {
  const payload = cloneFixture();
  const product = payload.included.find((entry) => entry.id === "product-road");
  assert.ok(product);
  product.attributes = {
    ...(product.attributes as object),
    tag_list: ["workshop-partner-bike"],
  };

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  assert.equal(snapshot.assignments.length, 1);
  assert.equal(snapshot.assignments[0].stockItemId, "stock-road-1");
  assert.equal(snapshot.assignments[0].displayId, "RF89RIVXL-2");
  assert.deepEqual(snapshot.assignments[0].workshopTags, ["workshop-partner-bike"]);
});

test("links.next without extra pages is INVALID_SNAPSHOT", () => {
  const payload = cloneFixture();
  payload.links = { next: "https://example.test/api/4/orders?page=2" };
  assert.throws(
    () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
    InvalidSourceSnapshotError,
  );
});

test("links.next href object is INVALID_SNAPSHOT", () => {
  const payload = cloneFixture();
  payload.links = { next: { href: "https://example.test/page=2" } };
  assert.throws(
    () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
    InvalidSourceSnapshotError,
  );
});

test("string false relevant is INVALID_SNAPSHOT", () => {
  const payload = cloneFixture();
  const bike = payload.included.find((entry) => entry.id === "line-bike");
  assert.ok(bike);
  bike.attributes = { ...(bike.attributes as object), relevant: "false" };
  assert.throws(
    () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
    InvalidSourceSnapshotError,
  );
});

test("omitted order.relationships.lines is INVALID_SNAPSHOT", () => {
  const payload = cloneFixture();
  assert.ok(payload.data.relationships);
  delete payload.data.relationships.lines;
  assert.throws(
    () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
    InvalidSourceSnapshotError,
  );
});

test("extra included line not in relationships.lines is ignored", () => {
  const payload = cloneFixture();
  payload.included.push({
    id: "line-extra-unrelated",
    type: "lines",
    attributes: {
      item_id: "product-extra-unrelated",
      title: "Unrelated extra",
      quantity: 1,
      relevant: true,
    },
    relationships: {
      planning: { data: { id: "planning-extra-unrelated", type: "plannings" } },
      item: { data: { id: "product-extra-unrelated", type: "products" } },
    },
  });
  payload.included.push({
    id: "planning-extra-unrelated",
    type: "plannings",
    attributes: {},
    relationships: {
      stock_item_plannings: {
        data: [{ id: "sip-extra-unrelated", type: "stock_item_plannings" }],
      },
    },
  });
  payload.included.push({
    id: "sip-extra-unrelated",
    type: "stock_item_plannings",
    attributes: {},
    relationships: {
      stock_item: { data: { id: "stock-extra-unrelated", type: "stock_items" } },
    },
  });
  payload.included.push({
    id: "stock-extra-unrelated",
    type: "stock_items",
    attributes: { identifier: "XX-1" },
  });
  payload.included.push({
    id: "product-extra-unrelated",
    type: "products",
    attributes: { tag_list: ["workshop-road-bike"] },
  });

  const snapshot = parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z");
  assert.equal(
    snapshot.lines.some((line) => line.booqableLineId === "line-extra-unrelated"),
    false,
  );
  assert.equal(snapshot.assignments.length, 1);
  assert.equal(snapshot.assignments[0].stockItemId, "stock-road-1");
});

test("missing order data is INVALID_SNAPSHOT", () => {
  assert.throws(
    () => parseSourceOrderSnapshot({ included: [] }, "2026-08-21T14:00:00.000Z"),
    InvalidSourceSnapshotError,
  );
});

test("dangling includes are INVALID_SNAPSHOT", () => {
  const cases = [
    { id: "customer-fixture-v1", label: "customer" },
    { id: "product-road", label: "item product" },
    { id: "planning-bike", label: "planning" },
    { id: "sip-road-1", label: "SIP" },
    { id: "stock-road-1", label: "stock_item" },
  ];
  for (const { id, label } of cases) {
    const payload = cloneFixture();
    omitIncluded(payload, id);
    assert.throws(
      () => parseSourceOrderSnapshot(payload, "2026-08-21T14:00:00.000Z"),
      InvalidSourceSnapshotError,
      `omitting ${label} include must throw`,
    );
  }
});

test("parser output keys match SQL snapshot keys", () => {
  const snapshot = parseSourceOrderSnapshot(loadFixture(), "2026-08-21T14:00:00.000Z");
  const required = [
    "schemaVersion",
    "sourceStatus",
    "assignments",
    "lines",
    "customer",
    "order",
    "coupon",
  ];
  for (const key of required) {
    assert.equal(key in snapshot, true, `envelope missing ${key}`);
  }
  assert.equal("startsAt" in snapshot.order, true);
  assert.ok(snapshot.customer);
  assert.equal("booqableCustomerId" in snapshot.customer, true);
  const line = snapshot.lines[0];
  assert.equal("booqableLineId" in line, true);
  assert.equal("parentBooqableLineId" in line, true);
  assert.equal("quantity" in line, true);
  const assignment = snapshot.assignments[0];
  for (const key of [
    "sipId",
    "stockItemId",
    "booqableLineId",
    "displayId",
    "title",
    "workshopTags",
  ]) {
    assert.equal(key in assignment, true, `assignment missing ${key}`);
  }

  const schemaSource = readFileSync(
    join(srcRoot, "lib/workshop/domain/source-snapshot.ts"),
    "utf8",
  );
  const zodKeys = new Set(
    [...schemaSource.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]),
  );
  const sql = readFileSync(
    join(root, "supabase/migrations/20260821160000_workshop_source_apply.sql"),
    "utf8",
  );
  const sqlSnapshotKeys = new Set<string>();
  for (const match of sql.matchAll(
    /p_snapshot((?:->'[^']+')*)(?:->>'([^']+)')?/g,
  )) {
    for (const step of match[1].matchAll(/->'([^']+)'/g)) {
      sqlSnapshotKeys.add(step[1]);
    }
    if (match[2]) sqlSnapshotKeys.add(match[2]);
  }
  const validationOnly = new Set(["links", "next"]);
  for (const key of sqlSnapshotKeys) {
    if (validationOnly.has(key)) continue;
    assert.equal(
      zodKeys.has(key),
      true,
      `SQL snapshot key ${key} is not defined on the Zod contract`,
    );
  }
});

test("domain module does not export the parser", () => {
  const source = readFileSync(
    join(srcRoot, "lib/workshop/domain/index.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /parseSourceOrderSnapshot/);
  assert.doesNotMatch(source, /parse-source-snapshot/);
  assert.match(source, /SourceOrderSnapshotV1Schema/);
  assert.equal(typeof SourceOrderSnapshotV1Schema.parse, "function");
});

test("workshop domain imports neither Next.js, Supabase, nor Booqable", () => {
  const domainDir = join(srcRoot, "lib/workshop/domain");
  for (const file of collectTsFiles(domainDir)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      FORBIDDEN_IMPORT,
      `${file} must not import Next.js, Supabase, or Booqable`,
    );
  }
});

test("parser does not import Next.js or write a database", () => {
  const source = readFileSync(
    join(srcRoot, "lib/booqable/parse-source-snapshot.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /from\s+["']next(?:\/|$)/);
  assert.doesNotMatch(source, /from\s+["']@supabase\//);
  assert.doesNotMatch(source, /\.from\(/);
  assert.doesNotMatch(source, /createClient/);
});
