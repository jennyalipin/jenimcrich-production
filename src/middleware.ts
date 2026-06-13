/**
 * Auth route gate.
 *
 * When Supabase is configured this refreshes the Supabase session (rotating
 * cookies onto the response) and gates routes by the signed-in user. Otherwise
 * it falls back to the signed `demo_session` cookie so the app runs with zero
 * config. Either way:
 *
 * - No session, protected route  → redirect to /login.
 * - Valid session visiting /login → redirect to /dashboard.
 * - Invalid/tampered demo cookies are cleared on the way through.
 *
 * Runs on the Node.js runtime (stable in Next 16): the demo cookie check uses
 * node:crypto via src/lib/demo-auth.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/demo-auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

function isLogin(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginRoute = isLogin(pathname);

  // The OAuth callback must run before a session exists — never gate it.
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  if (isSupabaseConfigured()) {
    const { response, user } = await updateSession(request);

    if (!user) {
      if (loginRoute) return response;
      // Don't redirect a server-action POST — that returns a 307→/login the
      // action client can't follow and the page crashes into an error
      // boundary. Let it through (RLS still blocks the write) so the action
      // returns a friendly result; the next full navigation will gate.
      if (request.headers.get("next-action")) return response;
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      // Preserve any refreshed auth cookies on the redirect.
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }

    if (loginRoute) {
      const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }

    return response;
  }

  // --- Demo fallback (no Supabase) ---
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    if (loginRoute) {
      if (token) {
        const response = NextResponse.next();
        response.cookies.delete(SESSION_COOKIE_NAME);
        return response;
      }
      return NextResponse.next();
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  if (loginRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // node:crypto in demo-auth requires the Node.js middleware runtime.
  runtime: "nodejs",
  // Everything except Next internals and public static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|json|woff2?|ttf|webmanifest)$).*)",
  ],
};
