/**
 * Supabase Auth session handling for Next.js middleware.
 *
 * Middleware can't use the Server-Component client (it owns the
 * request/response cookie lifecycle itself), so this wires `createServerClient`
 * straight to the NextRequest/NextResponse cookie APIs. Calling
 * `supabase.auth.getUser()` refreshes an expiring access token and writes the
 * rotated cookies onto the response — without this, sessions silently expire.
 *
 * Returns the user (or null) plus the response carrying any refreshed cookies;
 * the caller does route gating and must preserve those cookies on redirects.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/db";
import { getSupabaseEnv } from "./env";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) return { response, user: null };

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
