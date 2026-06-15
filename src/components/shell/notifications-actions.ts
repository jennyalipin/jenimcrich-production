"use server";

import { z } from "zod";
import { getDashboardStats } from "@/lib/data";
import { getSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { currentProfileId } from "@/lib/data/supabase-mutations";

export interface AppNotification {
  id: string;
  kind: "stalled" | "interview";
  title: string;
  detail: string;
}

/** Capitalizes a lowercase stage enum for human-readable display. */
function prettyStage(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

/**
 * `notification_reads` is not part of the generated `Database` types, so we
 * reach it through a minimal hand-typed view of the same RLS-scoped session
 * client. This keeps the rest of the codebase strictly typed without editing
 * db.ts, and avoids `never` insert/select inference on an unknown table.
 */
interface NotificationReadsClient {
  from(table: "notification_reads"): {
    select(columns: "notif_key"): {
      eq(
        column: "profile_id",
        value: string,
      ): Promise<{ data: { notif_key: string }[] | null }>;
    };
    upsert(
      rows: { profile_id: string; notif_key: string }[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): Promise<{ error: { message: string } | null }>;
  };
}

/** View the RLS-scoped session client as the notification_reads surface. */
function asReadsClient(supabase: SupabaseServerClient): NotificationReadsClient {
  return supabase as unknown as NotificationReadsClient;
}

/** Derive the full set of notifications (interviews first, then stalled). */
async function deriveNotifications(): Promise<AppNotification[]> {
  // getDashboardStats already returns today's interviews + the top stalled
  // (scalable, no whole-store load), so the bell poll reuses it.
  const stats = await getDashboardStats();
  const out: AppNotification[] = [];

  for (const iv of stats.todays_interviews) {
    out.push({
      id: `iv-${iv.id}`,
      kind: "interview",
      title: `Interview today — ${iv.candidate_name}`,
      detail: iv.job_title,
    });
  }

  for (const a of stats.stalled.slice(0, 6)) {
    out.push({
      id: `st-${a.application_id}`,
      kind: "stalled",
      title: `${a.candidate_name} is stalled in ${prettyStage(a.stage)}`,
      detail: `${a.days_stalled} days with no activity`,
    });
  }

  return out.slice(0, 8);
}

/** The set of notif keys this profile has already marked read, or empty. */
async function readKeysForCurrentProfile(): Promise<Set<string>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return new Set();
  const profileId = await currentProfileId(supabase);
  if (!profileId) return new Set();

  const { data } = await asReadsClient(supabase)
    .from("notification_reads")
    .select("notif_key")
    .eq("profile_id", profileId);

  return new Set((data ?? []).map((row) => row.notif_key));
}

/**
 * Real notifications, derived from the data layer: today's interviews first,
 * then the most stalled candidates. Capped at 8 items. Anything the current
 * profile has already dismissed (present in `notification_reads`) is excluded.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  const [all, read] = await Promise.all([deriveNotifications(), readKeysForCurrentProfile()]);
  return all.filter((n) => !read.has(n.id));
}

const keysSchema = z.array(z.string().min(1)).max(64);

/**
 * Mark the given notification ids as read for the current profile. Upserts on
 * (profile_id, notif_key) so re-dismissing is idempotent. No-ops gracefully
 * when Supabase/auth is unavailable.
 */
export async function markNotificationsRead(keys: string[]): Promise<void> {
  const parsed = keysSchema.parse(keys);
  if (parsed.length === 0) return;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return;
  const profileId = await currentProfileId(supabase);
  if (!profileId) return;

  await asReadsClient(supabase)
    .from("notification_reads")
    .upsert(
      parsed.map((notif_key) => ({ profile_id: profileId, notif_key })),
      { onConflict: "profile_id,notif_key", ignoreDuplicates: true },
    );
}

/** Mark every currently-visible notification read for the current profile. */
export async function markAllNotificationsRead(): Promise<void> {
  const current = await getNotifications();
  if (current.length === 0) return;
  await markNotificationsRead(current.map((n) => n.id));
}
