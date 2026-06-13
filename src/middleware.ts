/**
 * Demo-session gate (replaced by Supabase Auth middleware later).
 *
 * - No valid `demo_session` cookie  → redirect to /login.
 * - Valid session visiting /login   → redirect to /dashboard.
 * - Invalid/tampered cookies are cleared on the way through.
 *
 * Runs on the Node.js runtime (stable in Next 16) because the cookie
 * signature check uses node:crypto via src/lib/demo-auth.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/demo-auth";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");

  if (!session) {
    if (isLoginRoute) {
      // Already heading to the login screen — just drop any bad cookie.
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

  if (isLoginRoute) {
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
