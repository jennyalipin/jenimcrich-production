/**
 * Browser-side Supabase client (for "use client" components).
 *
 * Usage:
 *   const supabase = getSupabaseBrowserClient();
 *   if (!supabase) { ...demo-data fallback... }
 *   const { data } = await supabase.from("candidates").select("*");
 *
 * Returns null (never throws) while Supabase is unprovisioned, per the
 * isSupabaseConfigured() contract in ./env.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/db";
import { getSupabaseEnv } from "./env";

export type SupabaseBrowserClient = SupabaseClient<Database>;

let browserClient: SupabaseBrowserClient | null = null;

/**
 * Lazily-created singleton — one client (and one auth session listener) per
 * browser tab. Safe to call from any client component on every render.
 */
export function getSupabaseBrowserClient(): SupabaseBrowserClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  browserClient ??= createBrowserClient<Database>(env.url, env.anonKey);
  return browserClient;
}
