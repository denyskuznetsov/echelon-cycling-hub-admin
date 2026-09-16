import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the path a freshly-authenticated user should land on, based on their
 * role in `public.profiles`. Works with either the browser or server Supabase
 * client, since both expose the same query surface.
 *
 * Routing schema:
 *   - admin   -> /hq
 *   - manager -> /hq
 *   - partner -> /partner
 *   - mechanic -> /workshop
 *   - null role -> /pending
 *
 * There is intentionally no "default zone" fallback: users without a
 * recognized role are sent to /pending so an admin can assign one.
 */
export async function getPostLoginPath(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    console.error("getPostLoginPath: failed to load profile", error);
    return "/pending";
  }

  if (!profile.role) return "/pending";

  switch (profile.role) {
    case "admin":
    case "manager":
      return "/all-partners";
    case "partner":
      return "/partner";
    case "mechanic":
      return "/workshop";
    default:
      return "/pending";
  }
}
