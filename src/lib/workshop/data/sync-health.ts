import { createClient } from "@/src/utils/supabase/server";
import {
  isManualSyncScope,
  isWorkshopSyncRunState,
  type ManualSyncScope,
  type WorkshopSyncCounts,
  type WorkshopSyncRunState,
} from "@/src/lib/workshop/domain";

export type WorkshopSyncHealth = {
  lastSuccessAt: string | null;
  runId: string | null;
  scope: ManualSyncScope | null;
  state: WorkshopSyncRunState | null;
  cursor: string | null;
  counts: WorkshopSyncCounts;
  lastError: string | null;
  lastAttemptAt: string | null;
};

const EMPTY_COUNTS: WorkshopSyncCounts = {
  listed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
};

type HealthRow = {
  last_success_at: string | null;
  run_id: string | null;
  scope: string | null;
  state: string | null;
  cursor: string | null;
  listed: number | null;
  succeeded: number | null;
  failed: number | null;
  skipped: number | null;
  last_error: string | null;
  last_attempt_at: string | null;
};

function asCount(value: number | null): number {
  return value ?? 0;
}

/**
 * Latest manual-sync health row for `/workshop`.
 * `error` is set on a failed read; empty health is not treated as "no results".
 */
export async function loadWorkshopSyncHealth(): Promise<{
  health: WorkshopSyncHealth;
  error: string | null;
}> {
  const empty: WorkshopSyncHealth = {
    lastSuccessAt: null,
    runId: null,
    scope: null,
    state: null,
    cursor: null,
    counts: EMPTY_COUNTS,
    lastError: null,
    lastAttemptAt: null,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workshop_sync_health")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("workshop:", error);
    return { health: empty, error: error.message };
  }

  if (!data) {
    return { health: empty, error: null };
  }

  const row = data as HealthRow;
  return {
    health: {
      lastSuccessAt: row.last_success_at,
      runId: row.run_id,
      scope: isManualSyncScope(row.scope) ? row.scope : null,
      state: isWorkshopSyncRunState(row.state) ? row.state : null,
      cursor: row.cursor,
      counts: {
        listed: asCount(row.listed),
        succeeded: asCount(row.succeeded),
        failed: asCount(row.failed),
        skipped: asCount(row.skipped),
      },
      lastError: row.last_error,
      lastAttemptAt: row.last_attempt_at,
    },
    error: null,
  };
}

export type SelectedPeriodSyncHealth = {
  runId: string;
  state: WorkshopSyncRunState;
  fromDate: string;
  toDate: string;
  phase: "starts_at" | "stops_at" | "reconcile";
  page: number;
  counts: WorkshopSyncCounts;
  lastError: string | null;
  lastAttemptAt: string;
  finishedAt: string | null;
};

const SELECTED_COLUMNS = "id,state,from_date,to_date,discovery_phase,discovery_page,listed,succeeded,failed,skipped,last_error,last_attempt_at,finished_at,policy_version";

function parseSelectedHealth(data: Record<string, unknown>): SelectedPeriodSyncHealth | null {
  if (data.policy_version !== 1 || !isWorkshopSyncRunState(data.state) ||
      typeof data.id !== "string" || typeof data.from_date !== "string" || typeof data.to_date !== "string" ||
      !["starts_at", "stops_at", "reconcile"].includes(String(data.discovery_phase ?? "")) ||
      typeof data.discovery_page !== "number" || typeof data.last_attempt_at !== "string") return null;
  return {
    runId: data.id, state: data.state, fromDate: data.from_date, toDate: data.to_date,
    phase: data.discovery_phase as SelectedPeriodSyncHealth["phase"], page: data.discovery_page,
    counts: {
      listed: asCount(data.listed as number | null), succeeded: asCount(data.succeeded as number | null),
      failed: asCount(data.failed as number | null), skipped: asCount(data.skipped as number | null),
    },
    lastError: data.last_error as string | null, lastAttemptAt: data.last_attempt_at,
    finishedAt: data.finished_at as string | null,
  };
}

/** Latest selected-period run, read with the signed-in user's RLS client. */
export async function loadSelectedPeriodSyncHealth(): Promise<{
  health: SelectedPeriodSyncHealth | null;
  recoverableRuns: SelectedPeriodSyncHealth[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("booqable_sync_runs")
    .select(SELECTED_COLUMNS)
    .eq("scope", "selected_period")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("loadSelectedPeriodSyncHealth:", error);
    return { health: null, recoverableRuns: [], error: error.message };
  }
  const health = data ? parseSelectedHealth(data) : null;
  if (data && !health) {
    console.error("loadSelectedPeriodSyncHealth: invalid run metadata", data.id);
    return { health: null, recoverableRuns: [], error: "Saved refresh metadata is incomplete." };
  }
  const recoverableRuns: SelectedPeriodSyncHealth[] = [];
  for (let offset = 0; ; offset += 100) {
    const query = supabase.from("booqable_sync_runs").select(SELECTED_COLUMNS)
      .eq("scope", "selected_period").in("state", ["in_progress", "failed"])
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 99);
    const page = await query;
    if (page.error) {
      console.error("loadSelectedPeriodSyncHealth: recoverable runs", page.error);
      return { health, recoverableRuns: [], error: page.error.message };
    }
    for (const row of page.data ?? []) {
      if (row.id === health?.runId) continue;
      const parsed = parseSelectedHealth(row);
      if (!parsed) {
        console.error("loadSelectedPeriodSyncHealth: invalid recoverable run metadata", row.id);
        return { health, recoverableRuns: [], error: "Saved refresh metadata is incomplete." };
      }
      recoverableRuns.push(parsed);
    }
    if ((page.data?.length ?? 0) < 100) break;
  }
  return { health, recoverableRuns, error: null };
}
