/**
 * Server-side Supabase clients (Server Components, server actions, route
 * handlers). Do NOT import from client components — this pulls in
 * next/headers.
 *
 * Usage (RLS-scoped, acts as the signed-in user):
 *   const supabase = await getSupabaseServerClient();
 *   if (!supabase) { ...demo-data fallback... }
 *   const { data } = await supabase.from("jobs").select("*, job_skills(*)");
 *
 * Both helpers return null (never throw) while Supabase is unprovisioned,
 * per the isSupabaseConfigured() contract in ./env.
 *
 * Note for middleware: do not use these there — middleware must wire
 * createServerClient to the NextRequest/NextResponse cookie APIs itself so
 * refreshed auth tokens propagate to the response.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/db";
import { getServiceRoleKey, getSupabaseEnv } from "./env";

export type SupabaseServerClient = SupabaseClient<Database>;

/**
 * Per-request client bound to the caller's auth cookies; all queries run
 * under Row Level Security as that user. Create a fresh one per request —
 * never cache across requests.
 */
export async function getSupabaseServerClient(): Promise<SupabaseServerClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // cookies() is read-only inside Server Components; session refresh
          // is handled by the auth middleware instead. Safe to ignore.
        }
      },
    },
  });
}

let adminClient: SupabaseServerClient | null = null;

/**
 * Service-role client — BYPASSES RLS. Server only. Reserve for trusted
 * system paths: Resend webhook status updates on email_log, signed Storage
 * URL generation after an RLS-checked documents lookup, batch imports.
 * Requires SUPABASE_SERVICE_ROLE_KEY in addition to the public env; returns
 * null when either is missing.
 */
export function getSupabaseAdminClient(): SupabaseServerClient | null {
  const env = getSupabaseEnv();
  const serviceRoleKey = getServiceRoleKey();
  if (!env || !serviceRoleKey) return null;

  adminClient ??= createClient<Database>(env.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}
