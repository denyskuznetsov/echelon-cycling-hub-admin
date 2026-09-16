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
 * Call only after `withAuth` or an API `getUser()` check. It keeps a profile
 * read failure distinct from the valid, roleless pending state.
 */
export async function getActiveProfileAccess(): Promise<
  | { ok: true; role: UserRole }
  | { ok: false; error: string }
> {
  const { role, error } = await getMyProfile();
  if (error) {
    return { ok: false, error: "Could not verify your profile. Please try again." };
  }
  if (!role) {
    return { ok: false, error: "Your account is pending activation." };
  }
  return { ok: true, role };
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
