"use server";

/**
 * Server actions for the /candidates routes. Every mutation:
 *   1. validates input with zod (never trust client input),
 *   2. calls the data layer (or the store bridge for mutations the data
 *      layer does not expose yet),
 *   3. revalidates the whole tree — demo-store changes ripple into the
 *      dashboard, pipeline, analytics, etc.
 *
 * All actions return the uniform ActionResult shape from _lib/view-types,
 * with human-readable error messages (the agency owner is non-technical).
 * Candidate PII is never logged.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DataLayerError,
  INTERVIEW_TYPES,
  NOTE_CATEGORIES,
  RECOMMENDATIONS,
  SOURCES,
  STAGES,
  STAGE_LABELS,
  addNote,
  addScorecard,
  cancelInterview,
  moveApplicationStage,
  scheduleInterview,
} from "@/lib/data";
import type { CandidateSkill } from "@/lib/data/types";
import {
  addCandidateTag,
  insertCandidate,
  removeCandidateTag,
  setCandidateArchived,
  toggleCandidateFlag,
} from "./_lib/store-bridge";
import type { ActionResult } from "./_lib/view-types";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof DataLayerError) return { ok: false, error: error.message };
  return { ok: false, error: GENERIC_ERROR };
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

function refreshAll(): void {
  // Demo-store mutations affect dashboard, pipeline, jobs and analytics too.
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Add candidate                                                       */
/* ------------------------------------------------------------------ */

const createCandidateSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required."),
  email: z.email("Enter a valid email address."),
  phone: z.string().trim().max(40, "Keep the phone number under 40 characters.").default(""),
  location: z.string().trim().max(80, "Keep the location under 80 characters.").default(""),
  job_id: z.string().trim().min(1, "Choose the role they are applying for."),
  source: z.enum(SOURCES, "Choose where this candidate came from."),
  years_exp: z.coerce
    .number("Years of experience must be a number.")
    .int("Use whole years.")
    .min(0, "Years of experience cannot be negative.")
    .max(60, "Years of experience looks too high."),
  expected_salary: z.string().trim().max(60, "Keep the expected salary under 60 characters.").default(""),
  notice_period: z.string().trim().max(60, "Keep the notice period under 60 characters.").default(""),
  skills_raw: z.string().trim().max(500, "Keep the skills list under 500 characters.").default(""),
  summary: z.string().trim().max(2000, "Keep the summary under 2000 characters.").default(""),
});

/** "Plant Operations:8, Safety Compliance:5" → [{skill, years}] */
function parseSkills(raw: string): CandidateSkill[] {
  const seen = new Set<string>();
  const skills: CandidateSkill[] = [];
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const [name, yearsText] = entry.split(":");
    const skill = (name ?? "").trim();
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    const parsed = Number.parseInt((yearsText ?? "").trim(), 10);
    const years = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 60) : 1;
    skills.push({ skill, years });
  }
  return skills;
}

export async function createCandidate(
  raw: unknown,
): Promise<ActionResult<{ id: string; duplicateEmail: boolean }>> {
  const parsed = createCandidateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const { skills_raw, ...input } = parsed.data;
    const created = await insertCandidate({ ...input, skills: parseSkills(skills_raw) });
    refreshAll();
    return { ok: true, data: created };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Flag / archive / tags                                               */
/* ------------------------------------------------------------------ */

const idSchema = z.string().trim().min(1, "Missing candidate id.");
const tagSchema = z.object({
  candidate_id: idSchema,
  tag: z
    .string()
    .trim()
    .min(1, "Type a tag first.")
    .max(40, "Keep tags under 40 characters."),
});

export async function toggleFlag(candidateId: string): Promise<ActionResult<{ flagged: boolean }>> {
  const parsed = idSchema.safeParse(candidateId);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    const flagged = await toggleCandidateFlag(parsed.data);
    refreshAll();
    return { ok: true, data: { flagged } };
  } catch (error) {
    return failure(error);
  }
}

export async function setArchived(candidateId: string, archived: boolean): Promise<ActionResult> {
  const parsed = idSchema.safeParse(candidateId);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await setCandidateArchived(parsed.data, archived === true);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function addTag(candidateId: string, tag: string): Promise<ActionResult> {
  const parsed = tagSchema.safeParse({ candidate_id: candidateId, tag });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  try {
    await addCandidateTag(parsed.data.candidate_id, parsed.data.tag);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function removeTag(candidateId: string, tag: string): Promise<ActionResult> {
  const parsed = tagSchema.safeParse({ candidate_id: candidateId, tag });
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await removeCandidateTag(parsed.data.candidate_id, parsed.data.tag);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Stage moves                                                         */
/* ------------------------------------------------------------------ */

const stageSchema = z.object({
  application_id: z.string().trim().min(1),
  stage: z.enum(STAGES, "Choose a valid pipeline stage."),
});

export async function updateApplicationStage(raw: unknown): Promise<ActionResult<{ stageLabel: string }>> {
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Choose a valid pipeline stage." };
  try {
    await moveApplicationStage(parsed.data.application_id, parsed.data.stage);
    refreshAll();
    return { ok: true, data: { stageLabel: STAGE_LABELS[parsed.data.stage] } };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

const noteSchema = z.object({
  candidate_id: idSchema,
  category: z.enum(NOTE_CATEGORIES, "Choose a note category."),
  body: z
    .string()
    .trim()
    .min(1, "Write the note before saving.")
    .max(4000, "Keep notes under 4000 characters."),
});

export async function saveNote(raw: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    await addNote(parsed.data);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Scorecards                                                          */
/* ------------------------------------------------------------------ */

const scorecardSchema = z.object({
  application_id: z.string().trim().min(1, "Choose which application this scorecard is for."),
  interviewer_id: z.string().trim().min(1, "Choose the interviewer."),
  ratings: z
    .record(z.string(), z.number().int().min(1).max(5))
    .refine((r) => Object.keys(r).length > 0, "Rate at least one competency."),
  summary: z
    .string()
    .trim()
    .min(1, "A written summary is required for consistent feedback.")
    .max(2000, "Keep the summary under 2000 characters."),
  recommendation: z.enum(RECOMMENDATIONS, "Choose a recommendation."),
});

export async function saveScorecard(raw: unknown): Promise<ActionResult> {
  const parsed = scorecardSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    await addScorecard(parsed.data);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Interviews                                                          */
/* ------------------------------------------------------------------ */

const bookingSchema = z.object({
  application_id: z.string().trim().min(1, "Choose which application to book against."),
  interviewer_id: z.string().trim().min(1, "Choose the interviewer."),
  starts_at: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Pick a valid date and time slot."),
  interview_type: z.enum(INTERVIEW_TYPES, "Choose the interview type."),
});

export async function bookInterview(raw: unknown): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  try {
    await scheduleInterview(parsed.data);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelScheduledInterview(interviewId: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(1).safeParse(interviewId);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await cancelInterview(parsed.data);
    refreshAll();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
