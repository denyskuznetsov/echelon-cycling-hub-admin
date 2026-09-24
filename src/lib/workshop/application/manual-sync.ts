import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchSelectedPeriodOrderListPage,
  fetchWorkshopWindowOrderListPage,
} from "@/src/lib/booqable/fetch-source-snapshot";
import { resolveDashboardPeriod } from "@/src/lib/dashboard/period";
import { selectedPeriodEligible } from "@/src/lib/workshop/domain/commands";
import {
  parseWorkshopSyncResult,
  type ManualSyncScope,
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

function extractRunLease(data: unknown): { token: string; fence: number } | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const fence = coerceLeaseFence(record.fence);
  return typeof record.token === "string" && fence !== null
    ? { token: record.token, fence }
    : null;
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
  scope: "selected_period" | "next_7_days";
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

function parseStart(value: unknown, scope: Started["scope"]): Started | WorkshopSyncResult {
  const result = parseWorkshopSyncResult(value);
  if (!result.ok) return result;
  if (!selectedRecord(value) || typeof value.token !== "string" ||
      typeof value.fence !== "number" || !Number.isSafeInteger(value.fence) ||
      (value.phase !== "starts_at" && value.phase !== "stops_at" && value.phase !== "reconcile") ||
      typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 ||
      typeof value.fromInstant !== "string" || typeof value.toInstantExclusive !== "string" ||
      value.scope !== scope || value.policyVersion !== (scope === "selected_period" ? 1 : 2) ||
      (scope === "next_7_days" && value.phase === "stops_at")) return selectedFailed("Invalid saved refresh state.");
  return {
    runId: result.runId, scope, token: value.token, fence: value.fence,
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

async function continueSelected(value: unknown, userClient: SupabaseClient, scope: Started["scope"]): Promise<WorkshopSyncResult> {
  const started = parseStart(value, scope);
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
      const list = scope === "next_7_days"
        ? await fetchWorkshopWindowOrderListPage(started.page, started.fromInstant, started.toInstantExclusive)
        : await fetchSelectedPeriodOrderListPage(
          direction, started.page, started.fromInstant, started.toInstantExclusive,
        );
      const ids = list.orders.filter((order) => scope === "next_7_days"
        ? selectedPeriodEligible(
          order, "starts_at", started.fromInstant, started.toInstantExclusive,
        ) && order.status === "reserved"
        : selectedPeriodEligible(
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
    return await continueSelected(data, userClient, "selected_period");
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
    return await continueSelected(data, userClient, "selected_period");
  } catch (error) {
    console.error("dashboard-sync: resume", error);
    return selectedFailed(error instanceof Error ? error.message : "Could not resume refresh.");
  }
}

/** Workshop uses the same bounded discovery and reconciliation worker as Dashboard. */
export async function runManualSyncStart(
  userClient: SupabaseClient, scope: ManualSyncScope,
): Promise<WorkshopSyncResult> {
  if (scope !== "next_7_days") return selectedFailed("All Reserved sync has been retired.");
  if (!workshopSyncAllowed()) return selectedFailed("Booqable sync is disabled in this environment.");
  try {
    const { data, error } = await userClient.rpc("workshop_start_window_sync");
    if (error) throw error;
    if (selectedRecord(data) && data.ok === false) return parseWorkshopSyncResult(data);
    return await continueSelected(data, userClient, "next_7_days");
  } catch (error) {
    console.error("workshop-sync: start", error);
    return selectedFailed(error instanceof Error ? error.message : "Could not start Workshop refresh.");
  }
}

export async function runManualSyncResume(
  userClient: SupabaseClient, runId: string,
): Promise<WorkshopSyncResult> {
  if (!workshopSyncAllowed()) return selectedFailed("Booqable sync is disabled in this environment.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    return selectedFailed("Legacy Sync cursor cannot be resumed; start a fresh seven-day sync.");
  }
  try {
    const { data, error } = await userClient.rpc("workshop_resume_window_sync", { run_id: runId });
    if (error) throw error;
    if (selectedRecord(data) && data.ok === false) return parseWorkshopSyncResult(data);
    return await continueSelected(data, userClient, "next_7_days");
  } catch (error) {
    console.error("workshop-sync: resume", error);
    return selectedFailed(error instanceof Error ? error.message : "Could not resume Workshop refresh.");
  }
}
