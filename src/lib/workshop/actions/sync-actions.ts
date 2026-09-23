"use server";

import { loadLatestSelectedPeriodRun } from "@/src/lib/workshop/data/sync-health";
import { resolveDashboardPeriod } from "@/src/lib/dashboard/period";
import { workshopSyncAllowed } from "@/src/lib/workshop/application/sync-env";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import {
  isManualSyncScope,
  type ManualSyncScope,
  type WorkshopSyncResult,
} from "@/src/lib/workshop/domain";
import {
  runManualSyncResume,
  runManualSyncStart,
  runSelectedPeriodResume,
  runSelectedPeriodStart,
  syncTaskOrderFromBooqable,
} from "@/src/lib/workshop/application/manual-sync";

export const startManualSync = withAuth(
  "workshop:startManualSync",
  async (_user: User, scope: ManualSyncScope): Promise<WorkshopSyncResult> => {
    if (!isManualSyncScope(scope)) {
      return {
        ok: false,
        code: "SOURCE_UNAVAILABLE",
        error: "Unknown sync scope.",
      };
    }
    const supabase = await createClient();
    return runManualSyncStart(supabase, scope);
  },
);

export const resumeManualSync = withAuth(
  "workshop:resumeManualSync",
  async (_user: User, cursor: string): Promise<WorkshopSyncResult> => {
    const supabase = await createClient();
    return runManualSyncResume(supabase, cursor);
  },
);

export const syncOrderFromBooqable = withAuth(
  "workshop:syncOrderFromBooqable",
  async (_user: User, taskId: string): Promise<WorkshopSyncResult> => {
    const supabase = await createClient();
    return syncTaskOrderFromBooqable(supabase, taskId);
  },
);

// The worker can return ok:true for a durably saved failed run. Surface its persisted cause.
async function selectedOutcome(supabase: SupabaseClient, result: WorkshopSyncResult): Promise<WorkshopSyncResult> {
  if (!result.ok || result.state !== "failed") return result;
  const { data, error } = await supabase.from("booqable_sync_runs").select("last_error")
    .eq("id", result.runId).eq("scope", "selected_period").maybeSingle();
  if (error) console.error("dashboard:selectedOutcome:", error);
  return { ok: false, code: "SOURCE_UNAVAILABLE", error: data?.last_error?.trim() || "Sync could not refresh all required orders. Click Sync to try again." };
}

export const startSelectedPeriodSync = withAuth(
  "dashboard:startSelectedPeriodSync",
  async (_user: User, from: string, to: string): Promise<WorkshopSyncResult> => {
    const supabase = await createClient();
    if (!workshopSyncAllowed()) return { ok: false, code: "SOURCE_UNAVAILABLE", error: "Booqable sync is disabled in this environment." };
    const period = resolveDashboardPeriod({ period: "custom", from, to });
    if (period.error || period.from !== from || period.to !== to) {
      return { ok: false, code: "SOURCE_UNAVAILABLE", error: period.error ?? "Invalid selected dates." };
    }
    const latest = await loadLatestSelectedPeriodRun(supabase, from, to);
    if (latest.error) return { ok: false, code: "SOURCE_UNAVAILABLE", error: latest.error };
    const result = latest.health && latest.health.state !== "succeeded"
      ? await runSelectedPeriodResume(supabase, latest.health.runId)
      : await runSelectedPeriodStart(supabase, from, to);
    return selectedOutcome(supabase, result);
  },
);

export const resumeSelectedPeriodSync = withAuth(
  "dashboard:resumeSelectedPeriodSync",
  async (_user: User, runId: string): Promise<WorkshopSyncResult> => {
    const supabase = await createClient();
    return selectedOutcome(supabase, await runSelectedPeriodResume(supabase, runId));
  },
);
