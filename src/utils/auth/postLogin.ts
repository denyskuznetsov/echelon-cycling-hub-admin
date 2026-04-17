import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the path a freshly-authenticated user should land on, based on their
 * role in `public.profiles`. Works with either the browser or server Supabase
 * client, since both expose the same query surface.
 *
 * Falls back to `/dashboard` on any error or for roles without a dedicated
 * landing page — the destination route's own layout is still responsible for
 * authorization, so this is purely a UX redirect.
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
    return "/dashboard";
  }

  switch (profile.role) {
    case "partner":
      return "/partner";
    // Add more role → path mappings here as new sections are built:
    // case "mechanic": return "/mechanic";
    // case "manager":
    // case "admin":
    default:
      return "/dashboard";
  }
}
