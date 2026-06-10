/**
 * Route prefixes reachable WITHOUT a session. Everything else is
 * auth-protected by default: middleware redirects unauthenticated requests
 * to /login (preserving the target page in `?next=`).
 *
 * Shared between the Next.js middleware (server) and UserContext (client)
 * so both layers agree on what "public" means.
 *
 * Note: /api routes are not listed here — they are skipped by the middleware
 * redirect entirely because they authenticate themselves (webhook secrets,
 * service role, RLS) and external callers must never receive a login redirect.
 */
export const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth",
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
