/**
 * Supabase environment detection — safe to import anywhere (browser, server,
 * edge). Never throws at import time: the app must run on the demo data layer
 * when Supabase is not provisioned.
 *
 * Required keys (see docs/ARCHITECTURE.md → Environments):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (server only, optional — admin/webhook client)
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Public Supabase env, or null when not configured.
 * Property access is kept static (`process.env.NEXT_PUBLIC_*`) so Next.js can
 * inline the values into client bundles at build time.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Contract: `true` only when BOTH `NEXT_PUBLIC_SUPABASE_URL` and
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` are non-empty. When `false`, every helper
 * in client.ts / server.ts returns `null` instead of a client, and callers
 * must fall back to the demo data layer.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/**
 * For code paths that genuinely cannot proceed without Supabase (e.g. a
 * server action wired to real auth). Throws a human-readable error — never
 * call during module initialization.
 */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see docs/ARCHITECTURE.md). " +
        "Until then the app runs on built-in demo data.",
    );
  }
  return env;
}

/**
 * Service-role key for the server-only admin client (RLS bypass: Resend
 * webhooks, signed Storage URLs, imports). Never exposed to the browser —
 * non-NEXT_PUBLIC vars are absent from client bundles, so this returns null
 * there.
 */
export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}
