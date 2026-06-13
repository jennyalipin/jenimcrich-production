/**
 * Candidate mutations the demo data layer does not expose yet — ⚠️ SERVER-ONLY.
 *
 * The official data layer ("@/lib/data") covers stage moves, notes,
 * scorecards, interviews and email logging, but has no create / flag /
 * archive / tag mutations for candidates. Until those land there (or
 * Supabase is provisioned), this module extends the SAME in-memory demo
 * store the data layer keeps on `globalThis.__jmrDemoStore`, following its
 * exact conventions: shared `seq` counter for ids, `max(wall clock,
 * REFERENCE_NOW)` timestamps, and an activity-log entry per mutation
 * (domain rule 1 / audit trail).
 *
 * When the data layer grows these functions, delete this file and point
 * actions.ts at "@/lib/data" instead.
 */

import {
  DataLayerError,
  REFERENCE_NOW,
  getSettings,
  type ActivityLogEntry,
  type ActivityType,
  type Application,
  type Candidate,
  type CandidateSkill,
  type Job,
  type Source,
} from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  sbAddCandidateTag,
  sbInsertCandidate,
  sbRemoveCandidateTag,
  sbSetCandidateArchived,
  sbSetCandidateFlag,
} from "@/lib/data/supabase-mutations";

if (typeof window !== "undefined") {
  throw new Error("store-bridge is server-only. Call it from server actions.");
}

/** Structural subset of the data layer's DemoStore (same object instance). */
interface SharedStore {
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  activity_log: ActivityLogEntry[];
  seq: number;
}

const globalRef = globalThis as typeof globalThis & { __jmrDemoStore?: SharedStore };

/** The live store — seeded by the data layer on first access. */
async function store(): Promise<SharedStore> {
  // Any data-layer read initializes the shared store if needed.
  await getSettings();
  const s = globalRef.__jmrDemoStore;
  if (!s) {
    throw new DataLayerError("VALIDATION", "The demo data store is not available. Please reload and try again.");
  }
  return s;
}

const NOW_MS = REFERENCE_NOW.getTime();

function nowIso(): string {
  return new Date(Math.max(Date.now(), NOW_MS)).toISOString();
}

/** Shares the data layer's seq counter; "x" marks bridge-created rows. */
function uid(s: SharedStore, prefix: string): string {
  s.seq += 1;
  return `${prefix}-x${s.seq}`;
}

function logActivity(s: SharedStore, candidateId: string, type: ActivityType, body: string, actor: string): void {
  const ts = nowIso();
  s.activity_log.push({
    id: uid(s, "act"),
    candidate_id: candidateId,
    actor_name: actor,
    type,
    body,
    created_at: ts,
    updated_at: ts,
  });
}

function candidateOrThrow(s: SharedStore, id: string): Candidate {
  const cand = s.candidates.find((c) => c.id === id);
  if (!cand) {
    throw new DataLayerError("NOT_FOUND", "That candidate could not be found. They may have been archived.");
  }
  return cand;
}

/* ------------------------------------------------------------------ */
/* Create candidate (+ first application)                              */
/* ------------------------------------------------------------------ */

export interface NewCandidateInput {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  source: Source;
  years_exp: number;
  expected_salary: string;
  notice_period: string;
  summary: string;
  skills: CandidateSkill[];
  /** The role they are applying for — creates the first application. */
  job_id: string;
}

export interface CreatedCandidate {
  id: string;
  /** Warn-only email dedupe (per ARCHITECTURE.md, hard dedupe is Phase 4). */
  duplicateEmail: boolean;
}

/** Mirrors the prototype: summary + skill list until a real resume is parsed. */
function buildResumeText(summary: string, skills: CandidateSkill[]): string {
  return [summary.trim(), skills.map((sk) => sk.skill).join(", ")].filter(Boolean).join("\n\n");
}

export async function insertCandidate(input: NewCandidateInput): Promise<CreatedCandidate> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    return sbInsertCandidate(supabase, {
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      location: input.location,
      source: input.source,
      years_exp: input.years_exp,
      expected_salary: input.expected_salary,
      notice_period: input.notice_period,
      summary: input.summary,
      resume_text: buildResumeText(input.summary, input.skills),
      skills: input.skills,
      job_id: input.job_id,
    });
  }
  const s = await store();
  const job = s.jobs.find((j) => j.id === input.job_id && j.archived_at === null);
  if (!job) {
    throw new DataLayerError("NOT_FOUND", "The selected role could not be found. It may have been closed.");
  }

  const email = input.email.trim().toLowerCase();
  const duplicateEmail = s.candidates.some(
    (c) => c.archived_at === null && c.email.trim().toLowerCase() === email,
  );

  const ts = nowIso();
  const candidate: Candidate = {
    id: uid(s, "cand"),
    full_name: input.full_name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    location: input.location.trim(),
    source: input.source,
    years_exp: input.years_exp,
    summary: input.summary.trim(),
    expected_salary: input.expected_salary.trim(),
    notice_period: input.notice_period.trim(),
    // Mirrors the prototype: summary + skill list until a real resume is parsed.
    resume_text: [input.summary.trim(), input.skills.map((sk) => sk.skill).join(", ")]
      .filter(Boolean)
      .join("\n\n"),
    flagged: false,
    skills: input.skills,
    certifications: [],
    tags: [],
    archived_at: null,
    created_at: ts,
    updated_at: ts,
  };
  s.candidates.unshift(candidate);

  const application: Application = {
    id: uid(s, "app"),
    candidate_id: candidate.id,
    job_id: job.id,
    stage: "applied",
    stage_entered_at: ts,
    applied_at: ts,
    created_at: ts,
    updated_at: ts,
  };
  s.applications.push(application);

  // Same wording the seed/DB trigger uses for application inserts.
  logActivity(s, candidate.id, "stage", `Application received via ${candidate.source} — ${job.title}`, "Jenny M.");

  return { id: candidate.id, duplicateEmail };
}

/* ------------------------------------------------------------------ */
/* Flag / archive / tags                                               */
/* ------------------------------------------------------------------ */

export async function toggleCandidateFlag(id: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("candidates")
      .select("flagged")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      throw new DataLayerError("NOT_FOUND", "That candidate could not be found. They may have been archived.");
    }
    const next = !data.flagged;
    await sbSetCandidateFlag(supabase, id, next);
    return next;
  }
  const s = await store();
  const cand = candidateOrThrow(s, id);
  cand.flagged = !cand.flagged;
  cand.updated_at = nowIso();
  logActivity(s, cand.id, "flag", cand.flagged ? "Flagged as priority" : "Priority flag removed", "Jenny M.");
  return cand.flagged;
}

export async function setCandidateArchived(id: string, archived: boolean): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await sbSetCandidateArchived(supabase, id, archived);
    return;
  }
  const s = await store();
  const cand = candidateOrThrow(s, id);
  if ((cand.archived_at !== null) === archived) return; // no-op
  cand.archived_at = archived ? nowIso() : null;
  cand.updated_at = nowIso();
  logActivity(
    s,
    cand.id,
    "system",
    archived ? "Candidate archived — hidden from active lists (data kept)" : "Candidate restored from archive",
    "Jenny M.",
  );
}

export async function addCandidateTag(id: string, tag: string): Promise<void> {
  const clean = tag.trim();
  if (!clean) throw new DataLayerError("VALIDATION", "The tag cannot be empty.");
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await sbAddCandidateTag(supabase, id, clean);
    return;
  }
  const s = await store();
  const cand = candidateOrThrow(s, id);
  if (cand.tags.some((t) => t.toLowerCase() === clean.toLowerCase())) return; // already tagged
  cand.tags.push(clean);
  cand.updated_at = nowIso();
  logActivity(s, cand.id, "tag", `Tagged: ${clean}`, "Jenny M.");
}

export async function removeCandidateTag(id: string, tag: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await sbRemoveCandidateTag(supabase, id, tag);
    return;
  }
  const s = await store();
  const cand = candidateOrThrow(s, id);
  if (!cand.tags.includes(tag)) return;
  cand.tags = cand.tags.filter((t) => t !== tag);
  cand.updated_at = nowIso();
  logActivity(s, cand.id, "tag", `Removed tag: ${tag}`, "Jenny M.");
}
