import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchReservedOrderListPage, fetchSelectedPeriodOrderListPage } from "@/src/lib/booqable/fetch-source-snapshot";
import { resolveDashboardPeriod } from "@/src/lib/dashboard/period";
import { selectedPeriodEligible } from "@/src/lib/workshop/domain/commands";
import {
  decodeSyncCursor,
  encodeSyncCursor,
  parseWorkshopSyncResult,
  skipReason,
  type ManualSyncScope,
  type WorkshopSyncCounts,
  type WorkshopSyncResult,
} from "@/src/lib/workshop/domain";
import {
  coerceLeaseFence,
  createServiceRoleClient,
  MANUAL_LOCK_KEY,
  ORDER_LEASE_TTL_MS,
  reconcileBooqableOrder,
  startLeaseRenewLoop,
} from "./reconcile-order";
import { workshopSyncAllowed } from "./sync-env";

export { decodeSyncCursor, encodeSyncCursor };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function emptyCounts(): WorkshopSyncCounts {
  return { listed: 0, succeeded: 0, failed: 0, skipped: 0 };
}

async function rpcJson(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw error;
  }
  return data;
}

function extractRunLease(
  data: unknown,
): { token: string; fence: number } | null {
  if (!isRecord(data)) return null;
  const token = data.token;
  const fence = coerceLeaseFence(data.fence);
  if (typeof token === "string" && fence !== null) {
    return { token, fence };
  }
  return null;
}

async function releaseRunLease(
  supabase: SupabaseClient,
  token: string,
  fence: number,
): Promise<void> {
  try {
    await rpcJson(supabase, "booqable_release_run_lease", {
      lock_key: MANUAL_LOCK_KEY,
      token,
      fence,
    });
  } catch (error) {
    console.error("workshop:", error);
  }
}

async function releaseRunLeaseBestEffort(
  lease: { token: string; fence: number },
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await releaseRunLease(supabase, lease.token, lease.fence);
  } catch (error) {
    console.error("workshop:", error);
  }
}

async function renewRunLease(
  supabase: SupabaseClient,
  token: string,
  fence: number,
): Promise<void> {
  const renewed = await rpcJson(supabase, "booqable_renew_run_lease", {
    lock_key: MANUAL_LOCK_KEY,
    token,
    fence,
    expires_at: new Date(Date.now() + ORDER_LEASE_TTL_MS).toISOString(),
  });
  if (!isRecord(renewed) || renewed.ok !== true) {
    throw new Error("Failed to renew the manual sync run lease.");
  }
}

type StartedRun = {
  runId: string;
  token: string;
  fence: number;
  cursor: string | null;
  counts: WorkshopSyncCounts;
};

function parseStartedRun(data: unknown): WorkshopSyncResult | (StartedRun & { ok: true }) {
  const parsed = parseWorkshopSyncResult(
    isRecord(data)
      ? {
          ...data,
          cursor: data.cursor ?? null,
          counts: isRecord(data.counts) ? data.counts : emptyCounts(),
        }
      : data,
  );
  if (!parsed.ok) return parsed;
  if (!isRecord(data)) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Unexpected workshop sync result.",
    };
  }
  const lease = extractRunLease(data);
  if (!lease) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Unexpected workshop sync result.",
    };
  }
  return {
    ok: true,
    runId: parsed.runId,
    token: lease.token,
    fence: lease.fence,
    cursor: parsed.cursor,
    counts: parsed.counts,
  };
}

type PageProcessOutcome = {
  listingFailed: boolean;
  lastError: string | null;
  hasMore: boolean;
  orderIds: string[];
};

async function processReservedPageOrders(
  supabase: SupabaseClient,
  started: StartedRun,
  scope: ManualSyncScope,
  page: number,
): Promise<PageProcessOutcome> {
  let listingFailed = false;
  let lastError: string | null = null;
  let hasMore = false;
  let orderIds: string[] = [];

  try {
    const list = await fetchReservedOrderListPage(page);
    hasMore = list.hasMore;
    orderIds = list.orders.map((order) => order.id);

    for (const order of list.orders) {
      const skip = skipReason(order, scope);
      if (skip) {
        await rpcJson(supabase, "booqable_record_sync_result", {
          run_id: started.runId,
          booqable_order_id: order.id,
          ok: true,
          code: null,
          error: skip,
          skipped: true,
        });
        continue;
      }

      const result = await reconcileBooqableOrder(order.id, "manual", { supabase });
      await rpcJson(supabase, "booqable_record_sync_result", {
        run_id: started.runId,
        booqable_order_id: order.id,
        ok: result.ok,
        code: result.ok ? null : result.code,
        error: result.ok ? null : result.error,
        skipped: false,
      });
      if (!result.ok) {
        lastError = result.error;
      }
    }
  } catch (error) {
    listingFailed = true;
    lastError = error instanceof Error ? error.message : "Booqable list failed.";
    console.error("workshop:", error);
  }

  return { listingFailed, lastError, hasMore, orderIds };
}

async function finishAndReleaseRun(
  supabase: SupabaseClient,
  started: StartedRun,
  nextCursor: string | null,
  lastError: string | null,
  listingFailed: boolean,
): Promise<WorkshopSyncResult> {
  let finished: unknown;
  try {
    finished = await rpcJson(supabase, "booqable_finish_sync_run", {
      run_id: started.runId,
      cursor: nextCursor,
      last_error: lastError,
      listing_failed: listingFailed,
    });
  } catch (error) {
    console.error("workshop:", error);
    await releaseRunLease(supabase, started.token, started.fence);
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: error instanceof Error ? error.message : "Failed to record sync progress.",
    };
  }

  await releaseRunLease(supabase, started.token, started.fence);
  return parseWorkshopSyncResult(finished);
}

async function processReservedPage(
  supabase: SupabaseClient,
  started: StartedRun,
  scope: ManualSyncScope,
  page: number,
): Promise<WorkshopSyncResult> {
  let listingFailed = false;
  let lastError: string | null = null;
  let hasMore = false;

  const stopRenew = startLeaseRenewLoop(
    () => renewRunLease(supabase, started.token, started.fence),
    "workshop:",
  );

  try {
    await renewRunLease(supabase, started.token, started.fence);
    const outcome = await processReservedPageOrders(
      supabase,
      started,
      scope,
      page,
    );
    listingFailed = outcome.listingFailed;
    lastError = outcome.lastError;
    hasMore = outcome.hasMore;
  } catch (error) {
    listingFailed = true;
    lastError = error instanceof Error ? error.message : "Booqable list failed.";
    console.error("workshop:", error);
  } finally {
    stopRenew();
  }

  const pageFailed = listingFailed || lastError != null;
  const nextCursor = pageFailed
    ? encodeSyncCursor({ v: 1, scope, page, runId: started.runId })
    : hasMore
      ? encodeSyncCursor({
          v: 1,
          scope,
          page: page + 1,
          runId: started.runId,
        })
      : null;

  return finishAndReleaseRun(
    supabase,
    started,
    nextCursor,
    lastError,
    listingFailed,
  );
}

async function walkNext7DaysReservedPages(
  supabase: SupabaseClient,
  started: StartedRun,
): Promise<WorkshopSyncResult> {
  const scope = "next_7_days" as const;
  let listingFailed = false;
  let lastError: string | null = null;
  let page = 1;
  let hasMore = true;
  const seenIds = new Set<string>();

  const stopRenew = startLeaseRenewLoop(
    () => renewRunLease(supabase, started.token, started.fence),
    "workshop:",
  );

  try {
    await renewRunLease(supabase, started.token, started.fence);

    while (hasMore) {
      const outcome = await processReservedPageOrders(
        supabase,
        started,
        scope,
        page,
      );
      listingFailed = outcome.listingFailed;
      lastError = outcome.lastError;
      const pageFailed = listingFailed || lastError != null;
      if (pageFailed) {
        hasMore = false;
        break;
      }
      if (
        outcome.orderIds.length > 0 &&
        outcome.orderIds.every((id) => seenIds.has(id))
      ) {
        listingFailed = true;
        lastError =
          "Booqable reserved list repeated a page; stopping sync.";
        hasMore = false;
        break;
      }
      for (const id of outcome.orderIds) {
        seenIds.add(id);
      }
      hasMore = outcome.hasMore;
      if (hasMore) {
        page += 1;
      }
    }
  } catch (error) {
    listingFailed = true;
    lastError = error instanceof Error ? error.message : "Booqable list failed.";
    console.error("workshop:", error);
  } finally {
    stopRenew();
  }

  const pageFailed = listingFailed || lastError != null;
  const nextCursor = pageFailed
    ? encodeSyncCursor({ v: 1, scope, page, runId: started.runId })
    : null;

  return finishAndReleaseRun(
    supabase,
    started,
    nextCursor,
    lastError,
    listingFailed,
  );
}

async function withStartedManualSync(
  data: unknown,
  work: (
    supabase: SupabaseClient,
    started: StartedRun,
  ) => Promise<WorkshopSyncResult>,
): Promise<WorkshopSyncResult> {
  const lease = extractRunLease(data);
  const started = parseStartedRun(data);
  if (!("token" in started)) {
    if (lease) await releaseRunLeaseBestEffort(lease);
    return started;
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    console.error("workshop:", error);
    await releaseRunLeaseBestEffort(started);
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error:
        error instanceof Error
          ? error.message
          : "Service role client unavailable.",
    };
  }

  return work(supabase, started);
}

async function continueManualSync(
  data: unknown,
  scope: ManualSyncScope,
  page: number,
): Promise<WorkshopSyncResult> {
  return withStartedManualSync(data, (supabase, started) =>
    processReservedPage(supabase, started, scope, page),
  );
}

export async function runManualSyncStart(
  userClient: SupabaseClient,
  scope: ManualSyncScope,
): Promise<WorkshopSyncResult> {
  if (!workshopSyncAllowed()) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Booqable sync is disabled in this environment.",
    };
  }

  const { data, error } = await userClient.rpc("workshop_start_manual_sync", {
    scope,
  });
  if (error) {
    console.error("workshop:", error);
    return { ok: false, code: "SOURCE_UNAVAILABLE", error: error.message };
  }

  if (scope === "next_7_days") {
    return withStartedManualSync(data, walkNext7DaysReservedPages);
  }
  return continueManualSync(data, scope, 1);
}

export async function runManualSyncResume(
  userClient: SupabaseClient,
  cursorRaw: string,
): Promise<WorkshopSyncResult> {
  if (!workshopSyncAllowed()) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Booqable sync is disabled in this environment.",
    };
  }

  const cursor = decodeSyncCursor(cursorRaw);
  if (!cursor) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Sync cursor is unreadable; restart sync.",
    };
  }

  const { data, error } = await userClient.rpc("workshop_resume_manual_sync", {
    run_id: cursor.runId,
    scope: cursor.scope,
  });
  if (error) {
    console.error("workshop:", error);
    return { ok: false, code: "SOURCE_UNAVAILABLE", error: error.message };
  }

  return continueManualSync(data, cursor.scope, cursor.page);
}

export async function syncTaskOrderFromBooqable(
  userClient: SupabaseClient,
  taskId: string,
): Promise<WorkshopSyncResult> {
  if (!workshopSyncAllowed()) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Booqable sync is disabled in this environment.",
    };
  }

  const { data: role, error: roleError } = await userClient.rpc("get_user_role");
  if (roleError) {
    console.error("workshop:", roleError);
    return { ok: false, code: "SOURCE_UNAVAILABLE", error: roleError.message };
  }
  if (role !== "admin" && role !== "manager" && role !== "mechanic") {
    return { ok: false, code: "FORBIDDEN", error: "Staff role required." };
  }

  const { data: task, error: taskError } = await userClient
    .from("bike_tasks")
    .select("order_id")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) {
    console.error("workshop:", taskError);
    return { ok: false, code: "SOURCE_UNAVAILABLE", error: taskError.message };
  }
  if (!task?.order_id) {
    return { ok: false, code: "SOURCE_UNAVAILABLE", error: "Task not found." };
  }

  const supabase = createServiceRoleClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("booqable_order_id")
    .eq("id", task.order_id)
    .maybeSingle();
  if (orderError) {
    console.error("workshop:", orderError);
    return { ok: false, code: "SOURCE_UNAVAILABLE", error: orderError.message };
  }
  const booqableOrderId = order?.booqable_order_id;
  if (!booqableOrderId) {
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: "Order is missing a Booqable id.",
    };
  }

  const result = await reconcileBooqableOrder(booqableOrderId, "task", {
    supabase,
  });
  if (!result.ok) {
    return { ok: false, code: result.code, error: result.error };
  }
  return {
    ok: true,
    runId: taskId,
    state: "succeeded",
    cursor: null,
    counts: { listed: 1, succeeded: 1, failed: 0, skipped: 0 },
  };
}

type Phase = "starts_at" | "stops_at" | "reconcile";
type Started = {
  runId: string;
  token: string;
  fence: number;
  phase: Phase;
  page: number;
  fromInstant: string;
  toInstantExclusive: string;
};

function selectedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function selectedFailed(error: string): WorkshopSyncResult {
  return { ok: false, code: "SOURCE_UNAVAILABLE", error };
}

async function selectedRpc(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  if (!selectedRecord(data) || data.ok !== true) {
    throw new Error(selectedRecord(data) && typeof data.error === "string" ? data.error : `${name} failed.`);
  }
  return data;
}

function parseStart(value: unknown): Started | WorkshopSyncResult {
  const result = parseWorkshopSyncResult(value);
  if (!result.ok) return result;
  if (!selectedRecord(value) || typeof value.token !== "string" ||
      typeof value.fence !== "number" || !Number.isSafeInteger(value.fence) ||
      (value.phase !== "starts_at" && value.phase !== "stops_at" && value.phase !== "reconcile") ||
      typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 ||
      typeof value.fromInstant !== "string" || typeof value.toInstantExclusive !== "string" ||
      value.policyVersion !== 1) return selectedFailed("Invalid saved refresh state.");
  return {
    runId: result.runId, token: value.token, fence: value.fence,
    phase: value.phase, page: value.page,
    fromInstant: value.fromInstant, toInstantExclusive: value.toInstantExclusive,
  };
}

async function abortSelected(
  userClient: SupabaseClient, value: unknown, reason: string,
): Promise<boolean> {
  const lease = extractRunLease(value);
  if (!lease) return false;
  const runId = selectedRecord(value) && typeof value.runId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.runId)
      ? value.runId : null;
  try {
    const { data, error } = await userClient.rpc("dashboard_abort_selected_sync", {
      run_id: runId, token: lease.token, fence: lease.fence, reason,
    });
    if (error) throw error;
    if (!selectedRecord(data) || data.ok !== true) {
      throw new Error(selectedRecord(data) && typeof data.error === "string" ? data.error : "Could not save refresh failure.");
    }
    return true;
  } catch (error) {
    console.error("dashboard-sync: abort", error);
    return false;
  }
}

async function continueSelected(value: unknown, userClient: SupabaseClient): Promise<WorkshopSyncResult> {
  const started = parseStart(value);
  if (!("token" in started)) {
    if (selectedRecord(value) && value.ok === true) {
      await abortSelected(userClient, value, started.ok === false ? started.error : "Invalid saved refresh state.");
    }
    return started;
  }
  let client: SupabaseClient;
  try {
    client = createServiceRoleClient();
  } catch (error) {
    console.error("dashboard-sync: service client", error);
    const message = error instanceof Error ? error.message : "Service client unavailable.";
    await abortSelected(userClient, value, message);
    return selectedFailed(message);
  }
  const lease = { lock_key: MANUAL_LOCK_KEY, token: started.token, fence: started.fence };
  const renew = () => selectedRpc(client, "booqable_renew_run_lease", {
    ...lease, expires_at: new Date(Date.now() + ORDER_LEASE_TTL_MS).toISOString(),
  }).then(() => undefined);
  const stopRenew = startLeaseRenewLoop(renew, "dashboard-sync:");
  let listingError: string | null = null;
  let aborted = false;
  try {
    await renew();
    if (started.phase === "reconcile") {
      const work = await selectedRpc(client, "dashboard_selected_sync_work", {
        run_id: started.runId, token: started.token, fence: started.fence, batch_size: 10,
      });
      if (!selectedRecord(work) || !Array.isArray(work.ids) || !work.ids.every((id) => typeof id === "string")) {
        throw new Error("Invalid saved refresh candidates.");
      }
      for (const id of work.ids as string[]) {
        const result = await reconcileBooqableOrder(id, "manual", { supabase: client });
        await selectedRpc(client, "dashboard_record_selected_result", {
          run_id: started.runId, token: started.token, fence: started.fence,
          booqable_order_id: id, ok: result.ok,
          code: result.ok ? null : result.code,
          error: result.ok ? null : result.error,
        });
      }
    } else {
      const direction = started.phase;
      const list = await fetchSelectedPeriodOrderListPage(
        direction, started.page, started.fromInstant, started.toInstantExclusive,
      );
      const ids = list.orders.filter((order) => selectedPeriodEligible(
        order, direction, started.fromInstant, started.toInstantExclusive,
      )).map((order) => order.id);
      await selectedRpc(client, "dashboard_checkpoint_selected_sync", {
        run_id: started.runId, token: started.token, fence: started.fence,
        phase: started.phase, page: started.page, candidate_ids: ids,
        has_more: list.hasMore,
      });
    }
  } catch (error) {
    console.error("dashboard-sync:", error);
    listingError = error instanceof Error ? error.message : "Selected refresh failed.";
  } finally {
    stopRenew();
  }
  try {
    const final = await selectedRpc(client, "dashboard_finish_selected_sync", {
      run_id: started.runId, token: started.token, fence: started.fence,
      listing_error: listingError,
    });
    return parseWorkshopSyncResult(final);
  } catch (error) {
    console.error("dashboard-sync:", error);
    const message = error instanceof Error ? error.message : "Could not save refresh progress.";
    aborted = await abortSelected(userClient, value, message);
    return selectedFailed(message);
  } finally {
    if (!aborted) {
      try { await selectedRpc(client, "booqable_release_run_lease", lease); }
      catch (error) { console.error("dashboard-sync: release lease", error); }
    }
  }
}

export async function runSelectedPeriodStart(
  userClient: SupabaseClient, from: string, to: string,
): Promise<WorkshopSyncResult> {
  if (!workshopSyncAllowed()) return selectedFailed("Booqable sync is disabled in this environment.");
  const period = resolveDashboardPeriod({ period: "custom", from, to });
  if (period.error || period.from !== from || period.to !== to) {
    return selectedFailed(period.error ?? "Invalid selected dates.");
  }
  try {
    const { data, error } = await userClient.rpc("dashboard_start_selected_sync", { from_date: from, to_date: to });
    if (error) throw error;
    if (selectedRecord(data) && data.ok === false) return parseWorkshopSyncResult(data);
    return await continueSelected(data, userClient);
  } catch (error) {
    console.error("dashboard-sync: start", error);
    return selectedFailed(error instanceof Error ? error.message : "Could not start refresh.");
  }
}

export async function runSelectedPeriodResume(
  userClient: SupabaseClient, runId: string,
): Promise<WorkshopSyncResult> {
  if (!workshopSyncAllowed()) return selectedFailed("Booqable sync is disabled in this environment.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    return selectedFailed("Invalid refresh run ID.");
  }
  try {
    const { data, error } = await userClient.rpc("dashboard_resume_selected_sync", { run_id: runId });
    if (error) throw error;
    if (selectedRecord(data) && data.ok === false) return parseWorkshopSyncResult(data);
    return await continueSelected(data, userClient);
  } catch (error) {
    console.error("dashboard-sync: resume", error);
    return selectedFailed(error instanceof Error ? error.message : "Could not resume refresh.");
  }
}
