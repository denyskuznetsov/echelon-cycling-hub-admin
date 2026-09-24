export const WORKSHOP_STAFF_COMMANDS = [
  "workshop_set_item_outcome",
  "workshop_confirm_m2_item",
  "workshop_start_preparation",
  "workshop_complete_m1",
  "workshop_complete_m2",
  "workshop_mark_picked_up",
  "workshop_mark_returned",
  "workshop_start_storage",
  "workshop_complete_storage",
  "workshop_start_manual_sync",
  "workshop_resume_manual_sync",
] as const;

export const MANUAL_SYNC_SCOPES = ["next_7_days"] as const;

export type ManualSyncScope = (typeof MANUAL_SYNC_SCOPES)[number];

const SCOPE_SET = new Set<string>(MANUAL_SYNC_SCOPES);

export function isManualSyncScope(value: unknown): value is ManualSyncScope {
  return typeof value === "string" && SCOPE_SET.has(value);
}

export const WORKSHOP_SYNC_RUN_STATES = [
  "in_progress",
  "succeeded",
  "failed",
] as const;

export type WorkshopSyncRunState = (typeof WORKSHOP_SYNC_RUN_STATES)[number];

const RUN_STATE_SET = new Set<string>(WORKSHOP_SYNC_RUN_STATES);

export function isWorkshopSyncRunState(
  value: unknown,
): value is WorkshopSyncRunState {
  return typeof value === "string" && RUN_STATE_SET.has(value);
}

function madridIsoDate(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function madridDateFromStartsAt(startsAt: string | null): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

/** Reserved-list eligibility for staff Sync scopes (Madrid business dates). */
export function isEligibleManualSyncOrder(
  order: { status: string | null; startsAt: string | null },
  scope: ManualSyncScope,
  now = new Date(),
): boolean {
  if (order.status !== "reserved") return false;
  const start = madridDateFromStartsAt(order.startsAt);
  if (!start) return false;
  const today = madridIsoDate(now);
  return start >= today && start < addIsoDays(today, 7);
}

/** Skip reason used by list Sync; null means reconcile this reserved order. */
export type SyncCursorV1 = {
  v: 1;
  scope: ManualSyncScope;
  page: number;
  runId: string;
};

function isCursorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function encodeSyncCursor(cursor: SyncCursorV1): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSyncCursor(raw: string | null | undefined): SyncCursorV1 | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!isCursorRecord(parsed)) return null;
    if (
      parsed.v === 1 &&
      parsed.scope === "next_7_days" &&
      typeof parsed.runId === "string" &&
      Number.isInteger(parsed.page) &&
      (parsed.page as number) >= 1
    ) {
      return {
        v: 1,
        scope: parsed.scope,
        page: parsed.page as number,
        runId: parsed.runId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function skipReason(
  order: { status: string | null; startsAt: string | null },
  scope: ManualSyncScope,
  now = new Date(),
): string | null {
  if (isEligibleManualSyncOrder(order, scope, now)) return null;
  if (order.status !== "reserved") {
    return "skipped non-reserved status";
  }
  return "outside next 7 days";
}

/** Version 1 Dashboard policy: source date in the saved half-open interval. */
export function selectedPeriodEligible(
  order: { status: string | null; startsAt: string | null; stopsAt: string | null },
  direction: "starts_at" | "stops_at",
  fromInclusive: string,
  toExclusive: string,
): boolean {
  if (order.status === null) throw new Error("Booqable list omitted order status.");
  const scheduled = direction === "starts_at" ? order.startsAt : order.stopsAt;
  if (scheduled === null) throw new Error(`Booqable list omitted ${direction}.`);
  const instant = Date.parse(scheduled);
  const from = Date.parse(fromInclusive);
  const to = Date.parse(toExclusive);
  if (!Number.isFinite(instant) || !Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error("Booqable list contained an invalid date.");
  }
  return ["reserved", "started", "stopped"].includes(order.status)
    && instant >= from && instant < to;
}

export type WorkshopStaffCommand = (typeof WORKSHOP_STAFF_COMMANDS)[number];

export const WORKSHOP_ERROR_CODES = [
  "STALE_VERSION",
  "INVALID_TRANSITION",
  "INCOMPLETE_CHECKLIST",
  "ADD_ONS_CHANGED",
  "TASK_CANCELLED",
  "FORBIDDEN",
  "PROFILE_NAME_REQUIRED",
  "CONFIGURATION_BLOCKED",
  "SYNC_IN_PROGRESS",
  "SOURCE_UNAVAILABLE",
] as const;

export type WorkshopErrorCode = (typeof WORKSHOP_ERROR_CODES)[number];

const ERROR_CODE_SET = new Set<string>(WORKSHOP_ERROR_CODES);

export function isWorkshopErrorCode(value: unknown): value is WorkshopErrorCode {
  return typeof value === "string" && ERROR_CODE_SET.has(value);
}
