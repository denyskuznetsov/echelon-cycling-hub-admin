import { cache } from "react";
import { createClient } from "@/src/utils/supabase/server";

export type UserRole =
  | "admin"
  | "manager"
  | "mechanic"
  | "partner"
  | (string & {});

export interface ProfileResult {
  role: UserRole | null;
  error: string | null;
}

/**
 * Fetches the authenticated user's role from the `profiles` table.
 *
 * Wrapped in React.cache() so that multiple Server Components in the same
 * request tree (e.g. a layout + its child page) share a single round-trip.
 */
export const getMyProfile = cache(async (): Promise<ProfileResult> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { role: null, error: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("getMyProfile:", error);
    return { role: null, error: error.message };
  }

  return { role: (data?.role as UserRole | null) ?? null, error: null };
});
