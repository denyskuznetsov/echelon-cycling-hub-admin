import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicRoute } from "@/src/utils/auth/public-routes";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Default-deny: every route requires a session unless it is explicitly
  // public. Exceptions that handle auth themselves:
  // - /api/* routes (webhook secrets, service role, RLS) — external callers
  //   must never receive an HTML login redirect.
  // - Server action POSTs (identified by the Next-Action header) — withAuth()
  //   wraps every action and redirects via the framework mechanism, which
  //   navigates the client correctly (a raw 307 here would break the action
  //   protocol).
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");
  const isServerAction = request.headers.has("next-action");

  if (!user && !isApiRoute && !isServerAction && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    const next =
      pathname !== "/" ? `${pathname}${request.nextUrl.search}` : null;
    url.pathname = "/login";
    url.search = "";
    if (next) {
      url.searchParams.set("next", next);
    }
    return NextResponse.redirect(url);
  }

  // NOTE: we intentionally do NOT redirect authenticated users away from
  // auth routes (/login, /forgot-password) here. Those pages' server
  // components call requireAnonymous(), which is role-aware and routes
  // users to their correct landing page (e.g. partners -> /partner).
  // Handling it here would force a DB round-trip for role on every request.

  return response;
}
