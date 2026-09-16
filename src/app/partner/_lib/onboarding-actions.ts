"use server";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";

export type AcknowledgeResult = { ok: true } | { ok: false; error: string };

export const acknowledgeOnboarding = withAuth(
  "acknowledgeOnboarding",
  async (_user: User): Promise<AcknowledgeResult> => {
    const access = await getActiveProfileAccess();
    if (!access.ok) return access;

    const supabase = await createClient();
    const { error } = await supabase.rpc("acknowledge_onboarding");
    if (error) {
      console.error("acknowledgeOnboarding:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },
);
