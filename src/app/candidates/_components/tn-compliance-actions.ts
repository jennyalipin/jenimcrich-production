"use server";

/**
 * TN / USMCA compliance server actions.
 *
 * `runTnEligibilityCheckAction` runs (and persists, on Supabase) the
 * occupation eligibility screen for an application. `clearLegalReviewAction`
 * records an immigration attorney's sign-off — admin-only, re-checked here in
 * addition to the RLS update policy (defence in depth).
 *
 * NOTE: the eligibility screen is NOT legal advice (see lib/tn-eligibility);
 * the legal-review interlock keeps every result attorney-gated until cleared.
 */

import { revalidatePath } from "next/cache";
import {
  DataLayerError,
  clearTnLegalReview,
  runTnEligibilityCheck,
  type TnChecklistStatus,
} from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { currentProfileRole } from "@/lib/data/supabase-mutations";

export interface TnActionResult {
  ok: boolean;
  error?: string;
  status?: TnChecklistStatus;
}

function humanError(error: unknown, fallback: string): string {
  if (error instanceof DataLayerError) return error.message;
  return fallback;
}

/** Run + persist the TN eligibility screen for one application. */
export async function runTnEligibilityCheckAction(
  applicationId: string,
  candidateId: string,
): Promise<TnActionResult> {
  const id = applicationId.trim();
  if (!id) return { ok: false, error: "Missing application." };
  // Require a signed-in user on the live path (RLS enforces this too; the demo
  // store has no auth and is allowed through).
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in first." };
  }
  try {
    const status = await runTnEligibilityCheck(id);
    if (candidateId.trim()) revalidatePath(`/candidates/${candidateId.trim()}`);
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error: humanError(error, "Could not run the eligibility check. Please try again.") };
  }
}

/**
 * Clear the legal-review interlock (admin-only). The Supabase RLS update
 * policy already restricts who may write `tn_compliance`, but we also re-check
 * the role here so the demo path and a mis-scoped session both fail loudly.
 */
export async function clearLegalReviewAction(
  applicationId: string,
  candidateId: string,
  notes: string,
): Promise<TnActionResult> {
  const id = applicationId.trim();
  if (!id) return { ok: false, error: "Missing application." };

  // Recording an attorney sign-off is an admin-only production action: require
  // a live workspace and re-check the admin role here (defence in depth on top
  // of the RLS update policy + the admin-only column trigger in 0013).
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Sign in to a live workspace to record attorney sign-off." };
  }
  const role = await currentProfileRole(supabase);
  if (role !== "admin") {
    return { ok: false, error: "Only an admin can record the attorney sign-off." };
  }

  try {
    const status = await clearTnLegalReview(id, notes ?? "");
    if (candidateId.trim()) revalidatePath(`/candidates/${candidateId.trim()}`);
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error: humanError(error, "Could not clear the legal review. Please try again.") };
  }
}
