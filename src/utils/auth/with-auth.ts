import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { isPublicRoute } from "@/src/utils/auth/public-routes";

/**
 * Wraps a server action with a session check so a dead session never surfaces
 * as an opaque RLS/save failure. When the session is missing or expired the
 * browser is redirected to `/login?next=<calling page>` (derived from the
 * Referer header), so the user can log back in and resume where they left off.
 *
 * Session expiry is an auth boundary — handled by `redirect()` exactly like
 * the layout guards — NOT an expected domain failure, so it is never modeled
 * as `{ ok: false, error }`.
 *
 * Every server action in the app must be defined through this wrapper:
 *
 *   export const saveThing = withAuth(
 *     "saveThing",
 *     async (user, id: string): Promise<SaveResult> => {
 *       // session is guaranteed valid here
 *     },
 *   );
 */
export function withAuth<Args extends unknown[], Result>(
  name: string,
  action: (user: User, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error(
        `${name}: rejected — session missing or expired`,
        error ?? "(no user)",
      );
      redirect(buildLoginRedirectPath((await headers()).get("referer")));
    }

    return action(user, ...args);
  };
}

function buildLoginRedirectPath(referer: string | null): string {
  if (!referer) return "/login";

  try {
    const url = new URL(referer);
    if (url.pathname === "/" || isPublicRoute(url.pathname)) return "/login";
    return `/login?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
  } catch {
    return "/login";
  }
}
