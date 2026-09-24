import type { SupabaseClient } from "@supabase/supabase-js";
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

/** Select in PostgreSQL before considering recovery: completed newer runs supersede older attempts. */
export async function loadLatestSelectedPeriodRun(supabase: SupabaseClient, from: string, to: string): Promise<{
  health: SelectedPeriodSyncHealth | null;
  error: string | null;
}> {
  const { data, error } = await supabase.from("booqable_sync_runs")
    .select(SELECTED_COLUMNS)
    .eq("scope", "selected_period")
    .is("retired_at", null)
    .eq("from_date", from).eq("to_date", to)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (error) {
    console.error("loadLatestSelectedPeriodRun:", error);
    return { health: null, error: error.message };
  }
  const health = data ? parseSelectedHealth(data) : null;
  if (data && !health) {
    console.error("loadLatestSelectedPeriodRun: invalid run metadata", data.id);
    return { health: null, error: "Saved refresh metadata is incomplete." };
  }
  return { health, error: null };
}

/** Independent, bounded user-RLS reads for recovery and historical Dashboard success. */
export async function loadSelectedPeriodSyncHealth(from: string, to: string): Promise<{
  health: SelectedPeriodSyncHealth | null;
  lastSuccessAt: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const [latest, success] = await Promise.all([
    loadLatestSelectedPeriodRun(supabase, from, to),
    supabase.from("booqable_sync_runs").select("finished_at")
      .eq("scope", "selected_period").eq("policy_version", 1).eq("state", "succeeded")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false }).order("id", { ascending: false })
      .limit(1).maybeSingle(),
  ]);
  if (success.error) console.error("loadSelectedPeriodSyncHealth: success history", success.error);
  const finishedAt = success.data?.finished_at;
  const invalidSuccess = finishedAt != null && (typeof finishedAt !== "string" || !Number.isFinite(Date.parse(finishedAt)));
  if (invalidSuccess) console.error("loadSelectedPeriodSyncHealth: invalid success timestamp");
  return {
    health: latest.health,
    lastSuccessAt: !success.error && !invalidSuccess ? finishedAt ?? null : null,
    error: [latest.error, success.error?.message, invalidSuccess ? "Sync history is incomplete." : null].filter(Boolean).join(" ") || null,
  };
}
