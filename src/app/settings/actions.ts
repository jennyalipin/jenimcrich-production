"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DataLayerError,
  resetDemoData,
  updateSettings,
  type Settings,
} from "@/lib/data";
import { sbPurgeSampleData } from "@/lib/data/supabase-mutations";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

export interface SettingsActionResult {
  ok: boolean;
  /** Human-readable, safe to show in a toast. */
  message: string;
  settings?: Settings;
}

const patchSchema = z
  .object({
    stalled_enabled: z.boolean().optional(),
    stalled_days: z
      .union([z.literal(3), z.literal(5), z.literal(7), z.literal(10)])
      .optional(),
  })
  .refine(
    (patch) => patch.stalled_enabled !== undefined || patch.stalled_days !== undefined,
    { error: "Nothing to update." },
  );

/**
 * Update the stalled-candidate reminder settings (domain rule 3).
 * The threshold gates the dashboard's "needs attention" list and the
 * amber stalled markers across the app.
 */
export async function updateStalledSettings(patch: {
  stalled_enabled?: boolean;
  stalled_days?: number;
}): Promise<SettingsActionResult> {
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "The reminder threshold must be 3, 5, 7 or 10 days.",
    };
  }

  try {
    const settings = await updateSettings(parsed.data);
    // Stalled markers appear on the dashboard, pipeline and candidate lists.
    revalidatePath("/", "layout");

    const message =
      parsed.data.stalled_days !== undefined
        ? `Inactivity threshold set to ${settings.stalled_days} days.`
        : settings.stalled_enabled
          ? "Stalled-candidate reminders enabled."
          : "Stalled-candidate reminders disabled.";
    return { ok: true, message, settings };
  } catch (error) {
    if (error instanceof DataLayerError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Something went wrong while saving settings. Please try again.",
    };
  }
}

/** Restore the pristine demo seed (jobs, candidates, templates, settings). */
export async function resetDemo(): Promise<SettingsActionResult> {
  try {
    await resetDemoData();
    revalidatePath("/", "layout");
    return { ok: true, message: "Demo data restored to the original seed." };
  } catch {
    return {
      ok: false,
      message: "The demo data could not be reset. Please try again.",
    };
  }
}

/**
 * Permanently clear the seeded sample candidates, jobs and activity so the
 * workspace can start fresh with real data. Owner-only and irreversible;
 * email templates and your settings are kept.
 */
export async function clearSampleData(): Promise<SettingsActionResult> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Sample data can only be cleared on the live workspace.",
    };
  }

  // Owner-only: confirm the signed-in user is an admin before the wipe.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Your session has expired — please sign in again." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, message: "Only the workspace owner can clear sample data." };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { ok: false, message: "This action isn't available right now." };
  }

  try {
    const { candidates, jobs } = await sbPurgeSampleData(admin);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        candidates === 0 && jobs === 0
          ? "There was no sample data left to clear."
          : `Cleared ${candidates} candidate${candidates === 1 ? "" : "s"} and ${jobs} job${jobs === 1 ? "" : "s"}. Your workspace is ready for real data.`,
    };
  } catch (error) {
    if (error instanceof DataLayerError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "The sample data could not be cleared. Please try again.",
    };
  }
}
