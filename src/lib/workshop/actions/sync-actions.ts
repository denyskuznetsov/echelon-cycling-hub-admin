"use server";

import type { User } from "@supabase/supabase-js";
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

export const startSelectedPeriodSync = withAuth(
  "dashboard:startSelectedPeriodSync",
  async (_user: User, from: string, to: string): Promise<WorkshopSyncResult> => {
    const supabase = await createClient();
    return runSelectedPeriodStart(supabase, from, to);
  },
);

export const resumeSelectedPeriodSync = withAuth(
  "dashboard:resumeSelectedPeriodSync",
  async (_user: User, runId: string): Promise<WorkshopSyncResult> => {
    const supabase = await createClient();
    return runSelectedPeriodResume(supabase, runId);
  },
);
