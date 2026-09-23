import { redirect } from "next/navigation";
import { createClient } from "@/src/utils/supabase/server";
import { getPostLoginPath } from "./postLogin";

/**
 * Use in server components for pages that should only be shown to
 * unauthenticated users (e.g. `/login`, `/forgot-password`).
 *
 * If a user is already signed in, they are redirected to:
 *   - `fallbackNext` when provided (honors an explicit `?next=...`), or
 *   - the user's role-based landing path via `getPostLoginPath()`.
 *
 * Do NOT use this on `/reset-password` — that page is intentionally served
 * to authenticated users (Supabase creates a recovery session before landing
 * them there), and redirecting would break the password-reset flow.
 */
export async function requireAnonymous(
  fallbackNext?: string | null
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const target =
    (fallbackNext && fallbackNext.trim()) ||
    (await getPostLoginPath(supabase, user.id));

  redirect(target);
}
