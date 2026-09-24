import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildWorkshopQueueHref,
  formatMadridDateTime,
  formatWorkshopFromUntil,
  formatWorkshopQueueWhen,
  formatWorkshopStart,
  isM1ItemValid,
  isM2RecheckItem,
  m2ItemCaption,
  nextWorkshopTaskVersion,
  PREPARE_FOR_STORAGE_BADGE_CLASS,
  shouldLockChecklistForPending,
  queueStatusSelectValue,
  shouldBlockQueueNavigation,
  WORKSHOP_QUEUE_REALTIME_REFRESH_MS,
  WORKSHOP_SYNC_IN_PROGRESS_STALE_MS,
  workshopSyncOverlayListed,
  shouldRenderWorkshopQueue,
  statusBadgeVariant,
  statusFromQueueSelectValue,
  statusTileClassName,
  workshopBikeId,
  workshopBikeLabel,
  WORKSHOP_QUEUE_STATUS_SELECT_NONE,
  cleanAddonText,
  parseAddonTitle,
} from "./app/workshop/_components/workshop-ui.ts";
import {
  readWorkshopTabletMode,
  writeWorkshopTabletMode,
  WORKSHOP_TABLET_MODE_KEY,
} from "./app/workshop/_components/workshop-tablet-mode.ts";
import type { WorkshopCommandResult } from "./lib/workshop/domain/results.ts";
import type { WorkshopTaskItem } from "./lib/workshop/domain/dtos.ts";
import {
  resolveWorkshopQueueFilter,
  resolveWorkshopQueueStatus,
} from "./lib/workshop/domain/statuses.ts";
import {
  mapWorkshopSourceNotice,
  workshopSourceNoticeAlertProps,
} from "./lib/workshop/domain/source-notice.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function item(
  overrides: Partial<WorkshopTaskItem> = {},
): WorkshopTaskItem {
  return {
    itemId: "item-1",
    stage: "preparation",
    itemKey: "ROAD-01",
    sortOrder: 1,
    label: "Check",
    itemType: "action",
    required: true,
    m2Verifies: true,
    naAllowed: false,
    m1Outcome: null,
    m1Psi: null,
    m2Confirmed: false,
    ...overrides,
  };
}

test("cleanAddonText drops empty comma and pipe slots", () => {
  assert.equal(
    cleanAddonText(
      "from 20 EUR / day | , | 1300gr | , 45mm, Racing_Parts R45_Factory, Continental GP5000 S TR 30mm, 01 | Ultra",
    ),
    "from 20 EUR / day · 1300gr · 45mm, Racing_Parts R45_Factory, Continental GP5000 S TR 30mm, 01 · Ultra",
  );
  assert.equal(
    cleanAddonText("EUR per bike / per reservation | , 01 | Ultra, Covers 1000 EUR damage"),
    "EUR per bike / per reservation · 01 · Ultra, Covers 1000 EUR damage",
  );
  assert.equal(cleanAddonText("foo | FREE | bar"), "foo · bar");
});

test("parseAddonTitle splits label from cleaned value", () => {
  assert.deepEqual(
    parseAddonTitle(
      "Wheels - from 20 EUR / day | , | 1300gr | , 45mm, Racing_Parts R45_Factory",
    ),
    {
      label: "Wheels",
      value: "from 20 EUR / day · 1300gr · 45mm, Racing_Parts R45_Factory",
    },
  );
  assert.deepEqual(parseAddonTitle("Saddle bag"), {
    label: "Saddle bag",
    value: null,
  });
});

test("formatMadridDateTime joins date and time with a comma, not at", () => {
  const text = formatMadridDateTime("2026-08-22T10:20:00.000Z");
  assert.equal(text, "22 Aug 2026, 12:20");
  assert.doesNotMatch(text, /\bat\b/);
  assert.equal(
    formatMadridDateTime("2026-09-03T17:00:00.000Z"),
    "3 Sep 2026, 19:00",
  );
});

test("formatWorkshopStart uses DD-MM-YYYY HH:mm in Madrid", () => {
  assert.equal(
    formatWorkshopStart("2026-08-22T10:20:00.000Z", null),
    "22-08-2026 12:20",
  );
  assert.equal(formatWorkshopStart(null, "2026-08-22"), "2026-08-22");
  assert.equal(formatWorkshopStart("not-a-date", null), "—");
});

test("formatWorkshopFromUntil joins queue From and Until", () => {
  assert.equal(
    formatWorkshopFromUntil(
      "2026-08-22T10:20:00.000Z",
      "2026-08-23T08:00:00.000Z",
      null,
    ),
    "Sat 22 Aug · 12:20 – Sun 23 Aug · 10:00",
  );
  assert.equal(
    formatWorkshopFromUntil(null, null, "2026-08-22"),
    "2026-08-22 – —",
  );
});

test("formatWorkshopQueueWhen uses weekday day month · time in Madrid", () => {
  assert.equal(
    formatWorkshopQueueWhen("2026-08-22T10:20:00.000Z", null),
    "Sat 22 Aug · 12:20",
  );
  assert.equal(
    formatWorkshopQueueWhen("2026-09-03T17:00:00.000Z", null),
    "Thu 3 Sep · 19:00",
  );
  assert.doesNotMatch(
    formatWorkshopQueueWhen("2026-09-03T17:00:00.000Z", null),
    /Sept/,
  );
  assert.equal(formatWorkshopQueueWhen(null, "2026-08-22"), "2026-08-22");
  assert.equal(formatWorkshopQueueWhen("not-a-date", null), "—");
});

test("workshopBikeId is the trail crumb without the title", () => {
  assert.equal(
    workshopBikeId({
      bikeDisplayId: "RF97/L-1",
      bikeSourceId: "src",
    }),
    "RF97/L-1",
  );
  assert.equal(
    workshopBikeId({
      bikeDisplayId: null,
      bikeSourceId: "src-9",
    }),
    "src-9",
  );
});

test("workshopBikeLabel falls back to Unknown bike", () => {
  assert.equal(
    workshopBikeLabel({
      bikeDisplayId: "ECH-1",
      bikeSourceId: "src",
      bikeTitle: "Road",
    }),
    "ECH-1 · Road",
  );
  assert.equal(
    workshopBikeLabel({
      bikeDisplayId: null,
      bikeSourceId: "src-9",
      bikeTitle: null,
    }),
    "src-9",
  );
  assert.equal(
    workshopBikeLabel({
      bikeDisplayId: "  ",
      bikeSourceId: "  ",
      bikeTitle: null,
    }),
    "Unknown bike",
  );
});

test("invalid workshop filter becomes all", () => {
  assert.equal(resolveWorkshopQueueFilter("nope"), "all");
  assert.equal(resolveWorkshopQueueFilter(undefined), "all");
  assert.equal(resolveWorkshopQueueFilter("tomorrow"), "tomorrow");
  assert.equal(resolveWorkshopQueueFilter("today"), "today");
  assert.equal(resolveWorkshopQueueFilter("all"), "all");
});

test("queue status is opt-in; invalid or cancelled becomes active work", () => {
  assert.equal(resolveWorkshopQueueStatus(undefined), null);
  assert.equal(resolveWorkshopQueueStatus("nope"), null);
  assert.equal(resolveWorkshopQueueStatus("cancelled"), null);
  assert.equal(resolveWorkshopQueueStatus("completed"), "completed");
  assert.equal(resolveWorkshopQueueStatus("being_prepared"), "being_prepared");
});

test("workshop queue page size is 15", () => {
  const source = readFileSync(join(root, "src/lib/workshop/data/tasks.ts"), "utf8");
  assert.match(source, /export const WORKSHOP_PAGE_SIZE = 15/);
  assert.match(source, /replace\(\/\^#\/, ""\)/);
});

test("queue href omits filter=all and keeps filter=today", () => {
  assert.equal(
    buildWorkshopQueueHref("/workshop", "", 1, "all", null),
    "/workshop",
  );
  assert.equal(
    buildWorkshopQueueHref("/workshop", "", 1, "today", null),
    "/workshop?filter=today",
  );
  assert.equal(
    buildWorkshopQueueHref("/workshop", "", 1, "all", "being_prepared"),
    "/workshop?status=being_prepared",
  );
  assert.equal(
    buildWorkshopQueueHref("/workshop", "ana", 2, "today", "completed"),
    "/workshop?filter=today&status=completed&query=ana&page=2",
  );
});

test("in-flight sync blocks queue navigation", () => {
  const recent = new Date().toISOString();
  const stale = new Date(
    Date.now() - WORKSHOP_SYNC_IN_PROGRESS_STALE_MS - 1,
  ).toISOString();

  assert.equal(
    shouldBlockQueueNavigation(true, { state: "idle", cursor: null }),
    true,
  );
  assert.equal(
    shouldBlockQueueNavigation(false, {
      state: "in_progress",
      cursor: null,
      lastAttemptAt: recent,
    }),
    true,
  );
  assert.equal(
    shouldBlockQueueNavigation(false, {
      state: "in_progress",
      cursor: null,
      lastAttemptAt: stale,
    }),
    false,
  );
  assert.equal(
    shouldBlockQueueNavigation(false, {
      state: "in_progress",
      cursor: null,
      lastAttemptAt: null,
    }),
    false,
  );
  assert.equal(
    shouldBlockQueueNavigation(false, {
      state: "in_progress",
      cursor: "cursor-1",
      lastAttemptAt: recent,
    }),
    false,
  );
  assert.equal(
    shouldBlockQueueNavigation(false, { state: "failed", cursor: null }),
    false,
  );
});

test("overlay listed count ignores prior runs", () => {
  assert.equal(
    workshopSyncOverlayListed({
      state: "succeeded",
      counts: { listed: 29 },
    }),
    0,
  );
  assert.equal(
    workshopSyncOverlayListed({
      state: "in_progress",
      counts: { listed: 0 },
    }),
    0,
  );
  assert.equal(
    workshopSyncOverlayListed({
      state: "in_progress",
      counts: { listed: 12 },
    }),
    12,
  );
});

test("loader error is not treated as an empty success queue", () => {
  assert.equal(shouldRenderWorkshopQueue(null), true);
  assert.equal(shouldRenderWorkshopQueue("relation does not exist"), false);
});

test("isM1ItemValid requires a finite PSI greater than zero", () => {
  assert.equal(
    isM1ItemValid(
      item({
        itemType: "tyre_pressure_psi",
        m1Outcome: "completed",
        m1Psi: 80,
      }),
    ),
    true,
  );
  assert.equal(
    isM1ItemValid(
      item({
        itemType: "tyre_pressure_psi",
        m1Outcome: "completed",
        m1Psi: 0,
      }),
    ),
    false,
  );
  assert.equal(
    isM1ItemValid(
      item({
        itemType: "tyre_pressure_psi",
        m1Outcome: "completed",
        m1Psi: Number.NaN,
      }),
    ),
    false,
  );
  assert.equal(
    isM1ItemValid(
      item({
        itemType: "tyre_pressure_psi",
        m1Outcome: "completed",
        m1Psi: Number.POSITIVE_INFINITY,
      }),
    ),
    false,
  );
  assert.equal(
    isM1ItemValid(
      item({
        itemType: "tyre_pressure_psi",
        m1Outcome: "completed",
        m1Psi: null,
      }),
    ),
    false,
  );
});

test("task page I/O matrix: checklist stays clickable while item saves chain", () => {
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    join(root, "src/lib/workshop/actions/task-actions.ts"),
    "utf8",
  );
  const enqueueStart = task.indexOf("const enqueueItemCommand");
  const runStart = task.indexOf("const runCommand");
  assert.notEqual(enqueueStart, -1);
  assert.notEqual(runStart, -1);
  assert.ok(enqueueStart < runStart);
  const enqueue = task.slice(enqueueStart, runStart);
  const run = task.slice(runStart, task.indexOf("const isNamedPending"));

  // Rapid M1 taps: both go through the item queue; lists are not page-locked
  assert.match(task, /const setOutcome[\s\S]*enqueueItemCommand/);
  assert.match(
    task,
    /onComplete=\{\(itemId\) => setOutcome\(itemId, "completed"\)\}/,
  );
  const checklistInvocations = [
    ...task.matchAll(/<ChecklistItems[\s\S]*?\/>/g),
    ...task.matchAll(/<M2Checklist[\s\S]*?\/>/g),
  ].map((match) => match[0]);
  assert.equal(checklistInvocations.length, 3);
  for (const invocation of checklistInvocations) {
    assert.doesNotMatch(invocation, /disabled=\{isPending\}/);
  }
  assert.doesNotMatch(enqueue, /if \(isPending\) return/);
  assert.doesNotMatch(enqueue, /startTransition/);
  for (const invocation of checklistInvocations) {
    assert.match(invocation, /shouldLockChecklistForPending\(isPending\)/);
    assert.doesNotMatch(invocation, /itemSavesPending/);
  }

  // PSI during save
  assert.match(
    task,
    /onSetPsi=\{\(itemId, psi\) =>\s+setOutcome\(itemId, "completed", psi\)/,
  );

  // Rapid M2
  assert.match(
    task,
    /enqueueItemCommand\(\s*itemId,\s*\{\s*m2Confirmed: checked/,
  );
  assert.match(enqueue, /command\(taskVersionRef\.current\)/);
  assert.match(task, /confirmM2Item/);

  // Selected M1/M2 answers toggle clear through the same serialized queue.
  assert.match(task, /outcome: ChecklistItemOutcome \| null/);
  assert.match(task, /onClear=\{\(itemId\) => setOutcome\(itemId, null\)\}/);
  assert.match(task, /isDone \? onClear\(item\.itemId\) : onComplete\(item\.itemId\)/);
  assert.match(task, /isNa\s+\? onClear\(item\.itemId\)\s+: onNotApplicable\(item\.itemId\)/);
  assert.match(task, />\s*Clear\s*<\/Button>/);
  assert.match(task, /aria-label=\{`Clear \$\{item\.label\} value`\}/);
  assert.match(task, /aria-pressed=\{isDone\}/);
  assert.equal([...task.matchAll(/aria-pressed=\{isNa\}/g)].length, 2);
  assert.match(task, /aria-pressed=\{item\.m2Confirmed\}/);
  assert.match(task, /onConfirm\(item\.itemId, !item\.m2Confirmed\)/);
  assert.match(task, /\{ m2Confirmed: checked \}/);
  assert.match(actions, /outcome: ChecklistItemOutcome \| null/);
  assert.match(actions, /checked: boolean/);
  assert.match(actions, /item_id: itemId,\s+checked,/);

  // Add-ons / same-person / PSI drafts survive item success
  assert.doesNotMatch(enqueue, /setAddonsAcknowledged/);
  assert.doesNotMatch(enqueue, /setSamePersonConfirmed/);
  assert.doesNotMatch(enqueue, /setPsiDrafts/);
  assert.match(run, /setAddonsAcknowledged\(false\)/);

  // Item command fails: revert, log, banner
  assert.match(enqueue, /revertItemOverrideIfCurrent\(itemId, override\)/);
  assert.match(enqueue, /console\.error\("workshop:"/);
  assert.match(enqueue, /setCommandError/);
  assert.match(enqueue, /savedItemStatesRef\.current\[itemId\]/);

  // Own-version race: stage waits for the item queue, then latest version
  assert.match(run, /await itemQueueRef\.current/);
  assert.match(
    task,
    /completeM1\(\s*task\.taskId,\s*taskVersionRef\.current/,
  );
  assert.match(enqueue, /nextWorkshopTaskVersion/);
  assert.match(task, /disabled=\{isPending \|\| itemSavesPending \|\| !canCompleteM1\}/);
  assert.match(task, /disabled=\{isPending \|\| itemSavesPending \|\| !canCompleteM2\}/);
  assert.match(
    task,
    /disabled=\{isPending \|\| itemSavesPending \|\| !storageReady\}/,
  );

  // Saving cue while in flight; hidden when `saving` is false
  assert.equal(
    [...task.matchAll(/<StageCompleteRow saving=\{itemSavesPending\}>/g)]
      .length,
    3,
  );
  assert.match(task, /Complete Bike Preparation/);
  assert.match(task, /Complete Bike Verification/);
  assert.match(task, /Complete Bike Storage Preparation/);
  assert.match(task, /saving \? \(/);
  assert.match(task, /Saving…/);

  // Real stale: banner + refresh on item and stage paths
  assert.match(enqueue, /STALE_VERSION/);
  assert.match(enqueue, /router\.refresh\(\)/);
  assert.match(run, /STALE_VERSION/);
});

test("shouldLockChecklistForPending is only true for named stage actions", () => {
  assert.equal(shouldLockChecklistForPending(false), false);
  assert.equal(shouldLockChecklistForPending(true), true);
});

test("nextWorkshopTaskVersion chains successes and keeps last good on failure", () => {
  const ok = (
    version: number,
  ): WorkshopCommandResult => ({
    ok: true,
    taskId: "task-1",
    version,
    status: "being_prepared",
  });
  const fail: WorkshopCommandResult = {
    ok: false,
    code: "SOURCE_UNAVAILABLE",
    error: "save failed",
  };
  const afterFirst = nextWorkshopTaskVersion(3, ok(4));
  const afterSecond = nextWorkshopTaskVersion(afterFirst, ok(5));
  assert.equal(afterFirst, 4);
  assert.equal(afterSecond, 5);
  assert.equal(nextWorkshopTaskVersion(afterSecond, fail), 5);
});

test("M2 caption only carries a fact the recheck still needs", () => {
  assert.equal(m2ItemCaption(item({ m1Outcome: null })), "Preparation incomplete");
  assert.equal(m2ItemCaption(item({ m1Outcome: "completed" })), null);
  assert.equal(
    m2ItemCaption(
      item({
        itemType: "tyre_pressure_psi",
        m1Outcome: "completed",
        m1Psi: 80,
      }),
    ),
    "80 PSI",
  );
  assert.equal(
    m2ItemCaption(item({ m1Outcome: "not_applicable" })),
    "Marked not applicable",
  );
});

test("isM2RecheckItem is true only for designated items M1 did not mark N/A", () => {
  assert.equal(
    isM2RecheckItem(item({ m2Verifies: true, m1Outcome: "completed" })),
    true,
  );
  assert.equal(
    isM2RecheckItem(item({ m2Verifies: true, m1Outcome: null })),
    true,
  );
  assert.equal(
    isM2RecheckItem(item({ m2Verifies: true, m1Outcome: "not_applicable" })),
    false,
  );
  assert.equal(
    isM2RecheckItem(item({ m2Verifies: false, m1Outcome: "completed" })),
    false,
  );
  assert.equal(
    isM2RecheckItem(item({ m2Verifies: false, m1Outcome: "not_applicable" })),
    false,
  );
});

test("empty M2 recheck list is ready when every designated item is N/A", () => {
  const items = [
    item({ itemId: "na-1", m2Verifies: true, m1Outcome: "not_applicable" }),
    item({ itemId: "na-2", m2Verifies: true, m1Outcome: "not_applicable" }),
  ];
  const visible = items.filter(isM2RecheckItem);
  assert.equal(visible.length, 0);
  assert.equal(
    visible.every((row) => row.m2Confirmed),
    true,
  );
});

test("mixed M2 list hides N/A and is ready from the filtered rows only", () => {
  const items = [
    item({
      itemId: "road-16",
      itemKey: "ROAD-16",
      m2Verifies: true,
      m1Outcome: "not_applicable",
      m2Confirmed: false,
    }),
    item({
      itemId: "road-07",
      itemKey: "ROAD-07",
      m2Verifies: true,
      m1Outcome: "completed",
      m2Confirmed: true,
    }),
    item({
      itemId: "road-02",
      itemKey: "ROAD-02",
      m2Verifies: false,
      m1Outcome: "completed",
      m2Confirmed: false,
    }),
  ];
  const m2Items = items.filter(isM2RecheckItem);
  assert.deepEqual(
    m2Items.map((row) => row.itemId),
    ["road-07"],
  );
  assert.equal(
    m2Items.every((row) => row.m2Confirmed),
    true,
  );
  assert.equal(
    items
      .filter((row) => row.m2Verifies)
      .every((row) => row.m2Confirmed),
    false,
  );
});

test("mobile status select is clearable and label-only", () => {
  assert.equal(queueStatusSelectValue(null), WORKSHOP_QUEUE_STATUS_SELECT_NONE);
  assert.equal(queueStatusSelectValue("to_prepare"), "to_prepare");
  assert.equal(statusFromQueueSelectValue(WORKSHOP_QUEUE_STATUS_SELECT_NONE), null);
  assert.equal(statusFromQueueSelectValue("select"), null);
  assert.equal(statusFromQueueSelectValue("being_prepared"), "being_prepared");

  const queue = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopQueue.tsx"),
    "utf8",
  );
  assert.match(queue, /hidden w-full mobile:block/);
  assert.match(queue, /flex-wrap items-stretch gap-2 mobile:hidden/);
  assert.match(queue, /placeholder="Select"/);
  assert.match(queue, /WORKSHOP_QUEUE_STATUS_SELECT_NONE/);
  assert.match(queue, /WORKSHOP_STATUS_LABELS\[tileStatus\]/);
  const selectBlock = queue.slice(
    queue.indexOf("<Select"),
    queue.indexOf("</Select>") + "</Select>".length,
  );
  assert.match(selectBlock, /Select/);
  assert.doesNotMatch(selectBlock, /statusCounts/);
});

test("queue statuses use distinct badge colours", () => {
  assert.equal(statusBadgeVariant("to_prepare"), "warning");
  assert.equal(statusBadgeVariant("being_prepared"), "dark");
  assert.equal(statusBadgeVariant("needs_recheck"), "error");
  assert.equal(statusBadgeVariant("ready_for_pickup"), "info");
  assert.equal(statusBadgeVariant("in_rental"), "success");
  assert.equal(statusBadgeVariant("returned"), "mint");
  assert.equal(statusBadgeVariant("completed"), "neutral");
  assert.equal(statusBadgeVariant("cancelled"), "error");
  assert.equal(statusBadgeVariant("prepare_for_storage"), null);
  assert.match(PREPARE_FOR_STORAGE_BADGE_CLASS, /violet|slate/);
  const tileClasses = [
    statusTileClassName("to_prepare", false, 1),
    statusTileClassName("being_prepared", false, 1),
    statusTileClassName("needs_recheck", false, 1),
    statusTileClassName("ready_for_pickup", false, 1),
    statusTileClassName("in_rental", false, 1),
    statusTileClassName("returned", false, 1),
    statusTileClassName("prepare_for_storage", false, 1),
    statusTileClassName("completed", false, 1),
  ];
  assert.equal(new Set(tileClasses).size, tileClasses.length);
  assert.match(statusTileClassName("to_prepare", false, 0), /text-neutral-400/);
  assert.doesNotMatch(statusTileClassName("to_prepare", false, 0), /bg-brand-50/);
  assert.match(statusTileClassName("to_prepare", false, 3), /bg-brand-50/);
  assert.match(statusTileClassName("being_prepared", true, 2), /ring-offset-2/);
  const activeTile = statusTileClassName("to_prepare", false, 3);
  assert.match(activeTile, /(?:^|\s)border(?:\s|$)/);
  assert.match(activeTile, /border-neutral-200/);
  assert.match(activeTile, /shadow-\[inset_4px_0_0_0_rgb\(217_119_6\)\]/);
  assert.doesNotMatch(activeTile, /border-l-4/);
  assert.doesNotMatch(activeTile, /border-l-brand-/);
  assert.match(
    statusTileClassName("to_prepare", false, 0),
    /shadow-\[inset_4px_0_0_0_rgb\(253_230_138\)\]/,
  );
  assert.match(statusTileClassName("to_prepare", false, 1), /min-h-12/);
  assert.doesNotMatch(statusTileClassName("to_prepare", false, 1), /min-h-16/);
  assert.match(statusTileClassName("to_prepare", false, 1, true), /min-h-16/);
});

test("workshop page is a server component that reads URL filters", () => {
  const source = readFileSync(join(root, "src/app/workshop/page.tsx"), "utf8");
  assert.doesNotMatch(source, /["']use client["']/);
  assert.match(source, /searchParams: Promise</);
  assert.match(source, /resolveWorkshopQueueFilter/);
  assert.match(source, /loadWorkshopTasks/);
});

test("kanban files are gone", () => {
  const gone = [
    "src/components/KanbanBoard.tsx",
    "src/components/KanbanCard.tsx",
    "src/components/KanbanColumn.tsx",
    "src/components/kanban-types.ts",
  ];
  for (const file of gone) {
    assert.equal(existsSync(join(root, file)), false, file);
  }
});

test("hello-pangea/dnd is not a dependency", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.equal(pkg.dependencies?.["@hello-pangea/dnd"], undefined);
  assert.equal(pkg.devDependencies?.["@hello-pangea/dnd"], undefined);
});

test("queue I/O matrix: empty today, status isolate/clear, completed, page clamp, missing cells, sync intercept", () => {
  const queue = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopQueue.tsx"),
    "utf8",
  );
  const tasks = readFileSync(join(root, "src/lib/workshop/data/tasks.ts"), "utf8");
  const page = readFileSync(join(root, "src/app/workshop/page.tsx"), "utf8");

  assert.equal(resolveWorkshopQueueFilter("today"), "today");
  assert.equal(shouldRenderWorkshopQueue(null), true);
  assert.match(queue, /No tasks found/);
  assert.match(queue, /No bikes need work in this filter/);
  assert.doesNotMatch(page, /notFound\(\)/);

  assert.match(queue, /const nextStatus = selected \? null : tileStatus/);
  assert.match(queue, /buildWorkshopQueueHref/);
  assert.match(tasks, /Pick<WorkshopTaskListQuery, "filter" \| "query">/);

  assert.equal(resolveWorkshopQueueStatus("completed"), "completed");
  assert.match(tasks, /Completed is listed only when `status=completed`/);

  assert.match(tasks, /if \(page > totalPages\) page = 1/);
  assert.match(queue, /TablePagination/);

  assert.equal(formatWorkshopQueueWhen(null, null), "—");
  assert.match(queue, /task\.customerName\?\.trim\(\) \|\| "—"/);
  assert.match(queue, /formatWorkshopQueueWhen\(task\.stopsAt, null\)/);

  assert.match(queue, /if \(syncInFlight\) return/);
  assert.match(queue, /pushQueue/);
  assert.match(queue, /Stay on this page until it finishes/);
  assert.match(queue, /Pulls reserved orders starting in the next 7 days onto this list/);
  assert.match(queue, /syncStatusLabel && !syncInFlight/);
});

test("queue sync overlay continues saved next-7-days runs", () => {
  const queue = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopQueue.tsx"),
    "utf8",
  );

  assert.doesNotMatch(queue, /Sync all reserved/);
  assert.doesNotMatch(queue, /WorkshopSyncAllConfirmDialog/);
  assert.doesNotMatch(queue, /all_reserved/);
  assert.doesNotMatch(queue, /DialogLayout/);

  const next7Button = queue.slice(
    queue.indexOf('pendingScope === "next_7_days"'),
    queue.indexOf("Sync next 7 days"),
  );
  assert.match(next7Button, /runSync/);
  assert.match(next7Button, /startManualSync\("next_7_days"\)/);

  assert.doesNotMatch(queue, /Resume sync/);
  assert.match(queue, /resumeManualSync\(result\.runId\)/);
  assert.doesNotMatch(queue, /pendingScope === "resume"/);
  assert.doesNotMatch(queue, /resumable/);
  assert.doesNotMatch(queue, /more reserved orders remain/);
  assert.doesNotMatch(queue, /Use Resume/);
  assert.doesNotMatch(queue, /Each click fetches 50/);
  assert.match(queue, /syncStatusLabel && !syncInFlight/);
  assert.match(queue, /if \(syncInFlight\) return/);
  assert.match(queue, /WORKSHOP_QUEUE_REALTIME_REFRESH_MS/);
  assert.equal(WORKSHOP_QUEUE_REALTIME_REFRESH_MS, 1000);

  assert.match(queue, /WorkshopQueueSyncOverlay/);
  assert.match(queue, /fixed inset-0 z-50 flex items-center justify-center/);
  assert.match(queue, /syncInFlight \? \(/);
  assert.match(queue, /syncInFlight \? health\.counts\.listed : 0/);
  assert.match(queue, /inert=\{syncInFlight \|\| undefined\}/);
  assert.match(queue, /disabled=\{syncInFlight\}/);
  assert.match(queue, /Stay on this page until it finishes/);
  assert.match(queue, /\{listed\} orders processed/);
  assert.match(queue, /listed > 0/);
  assert.match(queue, /animate-\[nav-progress_1\.1s_ease-in-out_infinite\]/);
  assert.match(queue, /aria-busy/);
  assert.match(queue, /<Loader size="small" \/>/);
  assert.doesNotMatch(queue, /title="Updating from Booqable"/);
  assert.doesNotMatch(
    queue,
    /Updating from Booqable… stay on this page until it finishes/,
  );
  assert.doesNotMatch(queue, /@\/ui\/components\/Progress/);
  assert.doesNotMatch(queue, /<Progress[\s>]/);
  assert.match(queue, /syncError && !syncInFlight/);
});

test("queue surface: All-first tabs, status tiles, columns, sync help, load error banner", () => {
  const page = readFileSync(join(root, "src/app/workshop/page.tsx"), "utf8");
  const queue = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopQueue.tsx"),
    "utf8",
  );
  const tasks = readFileSync(join(root, "src/lib/workshop/data/tasks.ts"), "utf8");
  assert.match(page, /filter: filterParam/);
  assert.match(page, /status: statusParam/);
  assert.match(page, /query: queryParam/);
  assert.match(page, /page: pageParam/);
  assert.match(page, /DataLoadError/);
  assert.match(page, /loadWorkshopTaskStatusCounts/);
  assert.match(page, /heading=\{heading\}/);
  assert.match(queue, /text-body font-body text-subtext-color/);
  const helpStart = queue.indexOf(
    "Pulls reserved orders starting in the next 7 days onto this list",
  );
  assert.notEqual(helpStart, -1);
  assert.doesNotMatch(
    queue.slice(helpStart - 120, helpStart),
    /whitespace-nowrap/,
  );
  assert.match(queue, /value: "all".*Today/s);
  assert.match(queue, /buildWorkshopQueueHref/);
  assert.match(queue, /QUEUE_CELL_CLASS = "!h-16"/);
  assert.match(queue, /tabletMode \? QUEUE_CELL_CLASS/);
  assert.match(queue, /Bike ID/);
  assert.match(queue, /Bike title/);
  assert.match(queue, /Customer/);
  assert.match(queue, /Until/);
  assert.match(queue, /Warnings/);
  assert.doesNotMatch(queue, /@\/ui\/components\/Progress/);
  assert.doesNotMatch(queue, /<Progress[\s>]/);
  assert.match(queue, /Updating from Booqable/);
  assert.doesNotMatch(queue, /every reserved order \(slow\)/);
  assert.doesNotMatch(queue, /Sync all reserved/);
  assert.doesNotMatch(queue, /bg-warning-100/);
  assert.doesNotMatch(queue, /text-warning-800/);
  assert.match(queue, /text-heading-3 font-heading-3 text-default-font/);
  assert.match(queue, /Last successful seven-day sync:/);
  assert.match(queue, /\/workshop\/\$\{taskId\}/);
  assert.match(tasks, /status=completed|status\)/);
  assert.match(tasks, /neq\("status", "completed"\)/);
  assert.match(tasks, /customer_name\.ilike/);
});

test("queue refreshes use a table-local transition skeleton, separate from sync", () => {
  const queue = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopQueue.tsx"),
    "utf8",
  );
  const skeleton = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopLoadingSkeleton.tsx"),
    "utf8",
  );

  assert.match(
    queue,
    /const \[isQueueNavigationPending, startQueueNavigationTransition\] =\s*useTransition\(\);/,
  );
  assert.match(
    queue,
    /const \[isSyncPending, startSyncTransition\] = useTransition\(\);/,
  );
  assert.match(queue, /startQueueNavigationTransition\(\(\) => \{\s*router\.push/s);
  assert.match(queue, /const syncInFlight = isSyncPending/);
  assert.match(queue, /isQueueNavigationPending \? \(\s*<WorkshopTaskTableSkeleton \/>\s*\)/s);
  assert.match(queue, /syncInFlight \? \(\s*<WorkshopQueueSyncOverlay/s);
  assert.match(queue, /<SearchField/);
  assert.match(queue, /onSubmit=\{\(nextQuery\) => pushQueue\(nextQuery, 1, filter, status\)\}/);
  assert.match(
    queue,
    /onValueChange=\{\(value\) => \{\s*pushQueue\(query, 1, filter, statusFromQueueSelectValue\(value\)\);/s,
  );
  assert.match(queue, /const nextStatus = selected \? null : tileStatus;\s*pushQueue\(query, 1, filter, nextStatus\)/s);
  assert.match(queue, /pushQueue\(query, 1, tab\.value, status\)/);
  assert.match(queue, /onPageChange=\{\(nextPage\) =>\s*pushQueue\(query, nextPage, filter, status\)/s);

  assert.match(skeleton, /export function WorkshopTaskTableSkeleton/);
  assert.match(skeleton, /role="status"/);
  assert.match(skeleton, /aria-live="polite"/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.match(skeleton, /Loading workshop tasks/);
  assert.match(skeleton, /const TABLE_ROW_COUNT = 15/);
  assert.doesNotMatch(skeleton, /aria-label="Loading workshop tasks"/);
  assert.match(skeleton, /"Bike ID"/);
  assert.match(skeleton, /"Warnings"/);
});

test("task page: not-found vs error vs cancelled tombstone and named actions", () => {
  const page = readFileSync(
    join(root, "src/app/workshop/[taskId]/page.tsx"),
    "utf8",
  );
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    join(root, "src/lib/workshop/actions/task-actions.ts"),
    "utf8",
  );
  assert.match(page, /notFound\(\)/);
  assert.match(page, /Couldn't load this task/);
  assert.doesNotMatch(page, /fallback=\{null\}/);
  assert.match(task, /Abandon this work/);
  assert.match(task, /startPreparation/);
  assert.match(task, /completeM1/);
  assert.match(task, /completeM2/);
  assert.match(task, /isM2RecheckItem/);
  assert.match(task, /samePersonConfirmed/);
  assert.match(task, /markPickedUp/);
  assert.match(task, /markReturned/);
  assert.match(task, /completeStorage/);
  assert.match(
    task,
    /"completeStorage",\s*\(\) => router\.replace\("\/workshop"\)/,
  );
  assert.match(actions, /if \(result\.ok\) \{\s*revalidatePath\("\/workshop"\)/);
  assert.match(task, /STALE_VERSION/);
  assert.match(task, /CONFIGURATION_BLOCKED|hasConfigurationWarning/);
  assert.match(task, /Start preparation is blocked until the Booqable product tag is corrected/);
  assert.match(task, /task\.status === "to_prepare"/);
  assert.match(task, /Correct the Booqable product tag/);
  assert.match(task, /formatWorkshopFromUntil/);
  assert.doesNotMatch(task, /Starts /);
  assert.match(page, /key=\{item\.task\.taskId\}/);
  const checklistInvocations = [
    ...task.matchAll(/<ChecklistItems[\s\S]*?\/>/g),
    ...task.matchAll(/<M2Checklist[\s\S]*?\/>/g),
  ].map((match) => match[0]);
  assert.equal(checklistInvocations.length, 3);
  for (const invocation of checklistInvocations) {
    assert.doesNotMatch(invocation, /disabled=\{isPending\}/);
  }
  assert.match(task, /Saving…/);
});

test("task page reuses all-orders drawer via ?order=", () => {
  const layout = readFileSync(join(root, "src/app/workshop/layout.tsx"), "utf8");
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  assert.match(layout, /OrderDetailsDrawerHost/);
  assert.match(layout, /Suspense/);
  assert.match(task, /useOpenOrderDetails/);
  assert.match(task, /openOrderDetails\(orderId\)/);
  assert.match(task, /OrderDetailsButtonFallback/);
});

test("task page renders the persistent source reconciliation notice", () => {
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  const loader = readFileSync(
    join(root, "src/lib/workshop/data/tasks.ts"),
    "utf8",
  );
  const dto = readFileSync(
    join(root, "src/lib/workshop/domain/dtos.ts"),
    "utf8",
  );

  assert.match(dto, /WorkshopSourceNotice/);
  assert.match(dto, /sourceNotice: WorkshopSourceNotice \| null/);
  assert.match(loader, /sourceNotice: mapWorkshopSourceNotice\(root\.sourceNotice\)/);
  assert.match(task, /workshopSourceNoticeAlertProps\(detail\.sourceNotice\)/);
  assert.match(task, /title=\{sourceNoticeAlert\.title\}/);
  assert.match(task, /description=\{sourceNoticeAlert\.description\}/);

  const mapped = mapWorkshopSourceNotice({
    kind: "mixed",
    title: "Partial Booqable pickup or return",
    description:
      "This Booqable order has partial pickups or returns. Update this task manually.",
  });
  assert.deepEqual(workshopSourceNoticeAlertProps(mapped), {
    variant: "warning",
    title: "Partial Booqable pickup or return",
    description:
      "This Booqable order has partial pickups or returns. Update this task manually.",
  });
});

test("AddonsList renders extraInformation and keeps declined split", () => {
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  assert.match(task, /isDeclinedAddonChoice/);
  assert.match(task, /\/\^no\\b\/i/);
  assert.match(task, /addon\.extraInformation/);
  assert.match(task, /row\.extraInformation/);
});

test("order drawer shows stock tags on the matching line and keeps parents", () => {
  const drawer = readFileSync(
    join(root, "src/components/orders/OrderDetailsDrawer.tsx"),
    "utf8",
  );
  const orders = readFileSync(join(root, "src/lib/orders.ts"), "utf8");
  assert.match(orders, /booqable_assignment_instances/);
  assert.match(orders, /attachStockDisplayIdsToItems/);
  assert.match(drawer, /stock_display_ids/);
  assert.match(drawer, /stockTags\.map/);
  assert.match(drawer, /item\.line_type === "section"/);
  assert.doesNotMatch(drawer, /line_type === "bundle"/);
});

test("tablet mode storage is off unless the stored value is on", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  assert.equal(WORKSHOP_TABLET_MODE_KEY, "workshop.tabletMode");
  assert.equal(readWorkshopTabletMode(storage), false);

  writeWorkshopTabletMode(storage, true);
  assert.equal(store.get(WORKSHOP_TABLET_MODE_KEY), "on");
  assert.equal(readWorkshopTabletMode(storage), true);

  writeWorkshopTabletMode(storage, false);
  assert.equal(store.get(WORKSHOP_TABLET_MODE_KEY), "off");
  assert.equal(readWorkshopTabletMode(storage), false);

  store.set(WORKSHOP_TABLET_MODE_KEY, "yes");
  assert.equal(readWorkshopTabletMode(storage), false);

  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readWorkshopTabletMode(blocked), false);
  writeWorkshopTabletMode(blocked, true);
});

test("tablet mode switch is on list and task; density classes are conditional", () => {
  const page = readFileSync(join(root, "src/app/workshop/page.tsx"), "utf8");
  const layout = readFileSync(join(root, "src/app/workshop/layout.tsx"), "utf8");
  const provider = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTabletModeProvider.tsx"),
    "utf8",
  );
  const queue = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopQueue.tsx"),
    "utf8",
  );
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  const skeleton = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopLoadingSkeleton.tsx"),
    "utf8",
  );

  assert.match(layout, /WorkshopTabletModeProvider/);
  assert.match(provider, /writeWorkshopTabletMode\(window\.localStorage/);
  assert.match(provider, /try \{\s*return readWorkshopTabletMode\(window\.localStorage\)/s);
  assert.match(page, /WorkshopTabletModeSwitch/);
  assert.match(
    page,
    /shouldRenderWorkshopQueue\(loadError\)[\s\S]*: \(\s*<>\s*\{heading\}/,
  );
  assert.match(task, /WorkshopTabletModeSwitch/);
  assert.match(task, /useWorkshopTabletMode/);
  assert.match(queue, /useWorkshopTabletMode/);
  assert.match(task, /taskCopyClass/);
  assert.match(
    task,
    /TABLET_BADGE_CLASS = "h-7 \[&_span\]:!text-body \[&_span\]:!font-body"/,
  );
  assert.match(queue, /tabletMode \? QUEUE_CELL_CLASS/);
  assert.match(task, /tabletMode \? "large" : "medium"/);
  assert.match(task, /tabletMode \? "min-h-16" : "min-h-12"/);
  assert.match(skeleton, /h-12 min-w-28/);
});

test("task printing is a persistent, client-only surface outside task commands", () => {
  const task = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopTask.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    join(root, "src/app/workshop/_components/WorkshopPrintActions.tsx"),
    "utf8",
  );
  const page = readFileSync(
    join(root, "src/app/workshop/[taskId]/page.tsx"),
    "utf8",
  );

  assert.match(page, /resolveWorkshopPrinterConfig\(\)/);
  assert.match(task, /<WorkshopPrintActions detail=\{detail\} printerConfig=\{printerConfig\}/);
  assert.match(actions, /if \(detail\.task\.status === "cancelled"\) return null/);
  assert.match(actions, /createPrintAttemptGuard/);
  assert.match(actions, /sendPrintAttempt/);
  assert.doesNotMatch(actions, /workshopActions\./);
  assert.equal(
    existsSync(join(root, "src/app/workshop/printer-spike/page.tsx")),
    false,
  );
});
