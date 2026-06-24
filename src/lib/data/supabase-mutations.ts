/**
 * Supabase write path — ⚠️ SERVER-ONLY.
 *
 * Pure mutations against the RLS-scoped user client. They perform the bare
 * write and return minimal data; callers (index.ts, the jobs/candidates
 * overlays) re-hydrate via `loadStore` and compose return shapes with the
 * existing helpers, so there is no second copy of the join/derivation logic.
 *
 * Audit-trail division of labour (domain rule 1):
 *   - The DB does it for us on application INSERT and stage UPDATE
 *     (triggers `handle_application_created` / `handle_application_stage_change`,
 *     which also stamp `stage_entered_at` and attribute the actor via
 *     auth.uid()). These paths must NOT write activity themselves.
 *   - Everything else (note, scorecard, email, interview, flag, tag, archive)
 *     has no trigger, so we insert the matching `activity_log` row here.
 *
 * Actor attribution: `activity_log.actor_id` / author columns take the
 * signed-in user's profile id (looked up once per call). RLS guarantees the
 * write is allowed for that user — domain rule 7 lives in Postgres.
 */

import { DataLayerError } from "./types";
import { matchScore } from "@/lib/scoring";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  ActivityType,
  AddNoteInput,
  AddScorecardInput,
  InterviewType,
  LogEmailInput,
  NoteCategory,
  ScheduleInterviewInput,
  Source,
  Stage,
  StalledDays,
  TemplateCategory,
  TnComplianceRecord,
} from "./types";

type DbSource = "linkedin" | "referral" | "job_portal" | "indeed" | "agency" | "other";

/** Domain display sources → the DB's lowercase `candidate_source` enum. */
const SOURCE_TO_DB: Record<Source, DbSource> = {
  LinkedIn: "linkedin",
  Referral: "referral",
  "Job Portal": "job_portal",
  Indeed: "indeed",
  Agency: "agency",
};

function fail(label: string, error: { message: string; code?: string } | null): void {
  if (!error) return;
  // RLS denial (42501) or an expired/again missing JWT means the user's
  // session lapsed or they lack permission — give a human-readable nudge
  // instead of leaking a Postgres message to the non-technical owner.
  if (error.code === "42501" || /jwt|token|not authenticated|permission denied/i.test(error.message)) {
    throw new DataLayerError(
      "VALIDATION",
      "Your session has expired or you don't have permission for this. Please refresh the page and sign in again.",
    );
  }
  throw new DataLayerError("VALIDATION", `Could not ${label}. ${error.message}`);
}

/** The signed-in user's profile id (actor for audit rows), or null. */
export async function currentProfileId(supabase: SupabaseServerClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * The signed-in user's role (admin | recruiter | hiring_manager), or null.
 * A defence-in-depth check for server actions; RLS is still the real gate.
 */
export async function currentProfileRole(supabase: SupabaseServerClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

async function writeActivity(
  supabase: SupabaseServerClient,
  actorId: string | null,
  candidateId: string,
  type: ActivityType,
  body: string,
): Promise<void> {
  const { error } = await supabase
    .from("activity_log")
    .insert({ candidate_id: candidateId, actor_id: actorId, type, body });
  fail("record the activity", error);
}

/** Stage move — the trigger stamps `stage_entered_at` and logs the activity. */
export async function sbMoveStage(
  supabase: SupabaseServerClient,
  applicationId: string,
  stage: Stage,
): Promise<void> {
  const { data, error } = await supabase
    .from("applications")
    .update({ stage })
    .eq("id", applicationId)
    .select("id");
  fail("move the candidate", error);
  if (!data || data.length === 0) {
    throw new DataLayerError("NOT_FOUND", "That application could not be found.");
  }
}

export async function sbAddNote(
  supabase: SupabaseServerClient,
  input: AddNoteInput,
): Promise<string> {
  const actorId = await currentProfileId(supabase);
  const { data, error } = await supabase
    .from("notes")
    .insert({
      candidate_id: input.candidate_id,
      author_id: actorId,
      category: input.category as NoteCategory,
      body: input.body.trim(),
    })
    .select("id")
    .single();
  fail("save the note", error);
  await writeActivity(supabase, actorId, input.candidate_id, "note", "Note added");
  return data!.id;
}

export async function sbAddScorecard(
  supabase: SupabaseServerClient,
  input: AddScorecardInput,
  candidateId: string,
  interviewerName: string,
): Promise<string> {
  const actorId = await currentProfileId(supabase);
  const { data, error } = await supabase
    .from("scorecards")
    .insert({
      application_id: input.application_id,
      interviewer_id: input.interviewer_id,
      ratings: input.ratings,
      recommendation: input.recommendation,
      summary: input.summary.trim(),
    })
    .select("id")
    .single();
  fail("save the scorecard", error);
  await writeActivity(
    supabase,
    actorId,
    candidateId,
    "scorecard",
    `Scorecard submitted — ${interviewerName}`,
  );
  return data!.id;
}

export async function sbLogEmail(
  supabase: SupabaseServerClient,
  input: LogEmailInput,
  toEmail: string,
): Promise<string> {
  const actorId = await currentProfileId(supabase);
  const { data, error } = await supabase
    .from("email_log")
    .insert({
      candidate_id: input.candidate_id,
      template_id: input.template_id ?? null,
      to_email: toEmail,
      subject: input.subject,
      status: input.status ?? "sent",
    })
    .select("id")
    .single();
  fail("record the email", error);
  await writeActivity(
    supabase,
    actorId,
    input.candidate_id,
    "email",
    `Email sent: ${input.subject}`,
  );
  return data!.id;
}

/** True if the interviewer already holds a scheduled slot at that instant. */
export async function sbIsSlotTaken(
  supabase: SupabaseServerClient,
  interviewerId: string,
  startsAt: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("interviews")
    .select("id")
    .eq("interviewer_id", interviewerId)
    .eq("status", "scheduled")
    .eq("starts_at", startsAt)
    .limit(1);
  fail("check the interviewer's calendar", error);
  return (data?.length ?? 0) > 0;
}

export async function sbScheduleInterview(
  supabase: SupabaseServerClient,
  input: ScheduleInterviewInput,
  candidateId: string,
  interviewerName: string,
  slotTakenMessage: string,
): Promise<string> {
  const actorId = await currentProfileId(supabase);
  const startsAtIso = new Date(Date.parse(input.starts_at)).toISOString();
  const { data, error } = await supabase
    .from("interviews")
    .insert({
      application_id: input.application_id,
      interviewer_id: input.interviewer_id,
      starts_at: startsAtIso,
      duration_minutes: input.duration_minutes ?? 60,
      type: input.interview_type as InterviewType,
      status: "scheduled",
    })
    .select("id")
    .single();
  // The partial unique index (interviewer_id, starts_at) WHERE scheduled is
  // the real double-booking guard — surface it as SLOT_TAKEN.
  if (error?.code === "23505") {
    throw new DataLayerError("SLOT_TAKEN", slotTakenMessage);
  }
  fail("book the interview", error);
  await writeActivity(supabase, actorId, candidateId, "interview", `Interview booked: with ${interviewerName} — confirmations sent`);
  return data!.id;
}

export async function sbCancelInterview(
  supabase: SupabaseServerClient,
  id: string,
  candidateId: string,
  interviewerName: string,
): Promise<void> {
  const actorId = await currentProfileId(supabase);
  const { error } = await supabase
    .from("interviews")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "scheduled");
  fail("cancel the interview", error);
  await writeActivity(supabase, actorId, candidateId, "interview", `Interview cancelled (${interviewerName})`);
}

export async function sbUpdateSettings(
  supabase: SupabaseServerClient,
  patch: { stalled_days?: StalledDays; stalled_enabled?: boolean },
): Promise<void> {
  const update: { stalled_days?: number; stalled_enabled?: boolean } = {};
  if (patch.stalled_days !== undefined) update.stalled_days = patch.stalled_days;
  if (patch.stalled_enabled !== undefined) update.stalled_enabled = patch.stalled_enabled;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("settings").update(update).eq("singleton", true);
  fail("save the settings", error);
}

/* ------------------------------------------------------------------ */
/* Candidate overlay writes (store-bridge)                             */
/* ------------------------------------------------------------------ */

const clampWeight = (n: number): 1 | 2 | 3 => (n <= 1 ? 1 : n >= 3 ? 3 : 2);

/**
 * Recompute + persist applications.match_score for one candidate (the cache
 * the paginated list sorts by — domain rule 2). Call after anything that
 * changes a candidate's scoring inputs (creation, skill edits, new application).
 * Best-effort: a scoring failure must never break the surrounding mutation.
 */
export async function recomputeCandidateScores(
  supabase: SupabaseServerClient,
  candidateId: string,
): Promise<void> {
  try {
    const [{ data: cand }, { data: skills }, { data: certs }, { data: apps }] = await Promise.all([
      supabase.from("candidates").select("full_name, years_exp").eq("id", candidateId).maybeSingle(),
      supabase.from("candidate_skills").select("skill, years").eq("candidate_id", candidateId),
      supabase.from("candidate_certifications").select("name").eq("candidate_id", candidateId),
      supabase.from("applications").select("id, job_id").eq("candidate_id", candidateId),
    ]);
    if (!cand || !apps || apps.length === 0) return;

    const jobIds = apps.map((a) => a.job_id);
    const [{ data: jobs }, { data: jsk }] = await Promise.all([
      supabase.from("jobs").select("id, min_years").in("id", jobIds),
      supabase.from("job_skills").select("job_id, skill, weight").in("job_id", jobIds),
    ]);
    const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
    const skByJob = new Map<string, { skill: string; weight: 1 | 2 | 3 }[]>();
    for (const r of jsk ?? []) {
      const l = skByJob.get(r.job_id) ?? [];
      l.push({ skill: r.skill, weight: clampWeight(r.weight) });
      skByJob.set(r.job_id, l);
    }

    const candInput = {
      name: cand.full_name,
      yearsExp: cand.years_exp,
      skills: (skills ?? []).map((s) => ({ skill: s.skill, years: s.years })),
      certifications: (certs ?? []).map((c) => c.name),
    };
    const now = new Date().toISOString();
    for (const a of apps) {
      const job = jobById.get(a.job_id);
      if (!job) continue;
      const score = matchScore(candInput, {
        minYears: job.min_years,
        skills: skByJob.get(job.id) ?? [],
      }).score;
      await supabase.from("applications").update({ match_score: score, scored_at: now }).eq("id", a.id);
    }
  } catch {
    /* scoring is a cache; never block the write on it */
  }
}

export async function sbInsertCandidate(
  supabase: SupabaseServerClient,
  input: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    source: Source;
    years_exp: number;
    expected_salary: string;
    notice_period: string;
    summary: string;
    resume_text: string;
    skills: { skill: string; years: number }[];
    job_id: string;
  },
): Promise<{ id: string; duplicateEmail: boolean }> {
  const email = input.email.trim();
  const { data: dupes } = await supabase
    .from("candidates")
    .select("id")
    .is("archived_at", null)
    .ilike("email", email);
  const duplicateEmail = (dupes?.length ?? 0) > 0;

  const { data: cand, error: candErr } = await supabase
    .from("candidates")
    .insert({
      full_name: input.full_name.trim(),
      email,
      phone: input.phone.trim(),
      location: input.location.trim(),
      source: SOURCE_TO_DB[input.source],
      years_exp: input.years_exp,
      expected_salary: input.expected_salary.trim(),
      notice_period: input.notice_period.trim(),
      summary: input.summary.trim(),
      resume_text: input.resume_text,
    })
    .select("id")
    .single();
  fail("add the candidate", candErr);
  const candidateId = cand!.id;

  if (input.skills.length > 0) {
    const { error: skErr } = await supabase
      .from("candidate_skills")
      .insert(input.skills.map((s) => ({ candidate_id: candidateId, skill: s.skill, years: s.years })));
    fail("save the candidate's skills", skErr);
  }

  // The application-insert trigger writes the "Application received via …"
  // activity row; we only create the application itself.
  const { error: appErr } = await supabase
    .from("applications")
    .insert({ candidate_id: candidateId, job_id: input.job_id, stage: "applied" });
  fail("create the first application", appErr);

  // Populate the match_score cache so the new candidate ranks correctly.
  await recomputeCandidateScores(supabase, candidateId);

  return { id: candidateId, duplicateEmail };
}

/**
 * Bulk-import a candidate (no application). Skips (does not insert) when an
 * active candidate already has the same email — the caller counts these as
 * "skipped" so re-importing a CSV is safe.
 */
export async function sbImportCandidate(
  supabase: SupabaseServerClient,
  input: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    source: Source;
    years_exp: number;
    summary: string;
    skills: { skill: string; years: number }[];
    certifications: string[];
    tags: string[];
  },
): Promise<{ id: string; duplicateEmail: boolean }> {
  const email = input.email.trim();
  if (email) {
    const { data: dupes } = await supabase
      .from("candidates")
      .select("id")
      .is("archived_at", null)
      .ilike("email", email);
    if ((dupes?.length ?? 0) > 0) return { id: "", duplicateEmail: true };
  }

  const { data: cand, error: candErr } = await supabase
    .from("candidates")
    .insert({
      full_name: input.full_name.trim(),
      email: email || null,
      phone: input.phone.trim(),
      location: input.location.trim(),
      source: SOURCE_TO_DB[input.source],
      years_exp: input.years_exp,
      summary: input.summary.trim(),
    })
    .select("id")
    .single();
  fail("import the candidate", candErr);
  const candidateId = cand!.id;

  if (input.skills.length > 0) {
    const { error } = await supabase
      .from("candidate_skills")
      .insert(input.skills.map((s) => ({ candidate_id: candidateId, skill: s.skill, years: s.years })));
    fail("import the candidate's skills", error);
  }
  if (input.certifications.length > 0) {
    const { error } = await supabase
      .from("candidate_certifications")
      .insert(input.certifications.map((name) => ({ candidate_id: candidateId, name })));
    fail("import the candidate's certifications", error);
  }
  if (input.tags.length > 0) {
    const { error } = await supabase
      .from("candidate_tags")
      .insert(input.tags.map((tag) => ({ candidate_id: candidateId, tag })));
    fail("import the candidate's tags", error);
  }

  return { id: candidateId, duplicateEmail: false };
}

export async function sbSetCandidateFlag(
  supabase: SupabaseServerClient,
  id: string,
  flagged: boolean,
): Promise<void> {
  const actorId = await currentProfileId(supabase);
  const { error } = await supabase.from("candidates").update({ flagged }).eq("id", id);
  fail("update the flag", error);
  await writeActivity(supabase, actorId, id, "flag", flagged ? "Flagged as priority" : "Priority flag removed");
}

export async function sbSetCandidateArchived(
  supabase: SupabaseServerClient,
  id: string,
  archived: boolean,
): Promise<void> {
  const actorId = await currentProfileId(supabase);
  const { error } = await supabase
    .from("candidates")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  fail("update the candidate", error);
  await writeActivity(
    supabase,
    actorId,
    id,
    "system",
    archived
      ? "Candidate archived — hidden from active lists (data kept)"
      : "Candidate restored from archive",
  );
}

export async function sbAddCandidateTag(
  supabase: SupabaseServerClient,
  id: string,
  tag: string,
): Promise<void> {
  const actorId = await currentProfileId(supabase);
  const { data: existing } = await supabase
    .from("candidate_tags")
    .select("tag")
    .eq("candidate_id", id);
  if (existing?.some((t) => t.tag.toLowerCase() === tag.toLowerCase())) return;
  const { error } = await supabase.from("candidate_tags").insert({ candidate_id: id, tag });
  fail("add the tag", error);
  await writeActivity(supabase, actorId, id, "tag", `Tagged: ${tag}`);
}

export async function sbRemoveCandidateTag(
  supabase: SupabaseServerClient,
  id: string,
  tag: string,
): Promise<void> {
  const actorId = await currentProfileId(supabase);
  const { error } = await supabase
    .from("candidate_tags")
    .delete()
    .eq("candidate_id", id)
    .eq("tag", tag);
  fail("remove the tag", error);
  await writeActivity(supabase, actorId, id, "tag", `Removed tag: ${tag}`);
}

/* ------------------------------------------------------------------ */
/* Job overlay writes (job-store)                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve a client by name, creating one when it doesn't exist yet. The Jobs
 * "New job" flow lets the owner type a client name freely (a new client they
 * just signed), so a brand-new name must yield a real `clients` row — the demo
 * `local-cl-…` placeholder is not a valid uuid for the FK. Match is
 * case-insensitive on the trimmed name to avoid duplicating an existing client.
 */
export async function sbResolveClientId(
  supabase: SupabaseServerClient,
  name: string,
): Promise<string> {
  const trimmed = name.trim();
  const { data: existing, error: findErr } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", trimmed)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  fail("look up the client", findErr);
  if (existing) return existing.id;

  const { data: created, error: createErr } = await supabase
    .from("clients")
    .insert({ name: trimmed })
    .select("id")
    .single();
  fail("create the client", createErr);
  return created!.id;
}

export async function sbCreateJob(
  supabase: SupabaseServerClient,
  input: {
    title: string;
    client_id: string;
    location: string;
    salary_range: string;
    min_years: number;
    status: "open" | "on_hold" | "closed";
    visa: string;
    visa_notes: string | null;
    skills: { skill: string; weight: 1 | 2 | 3 }[];
    requirements: string[];
    description: string;
    jd_text: string;
  },
): Promise<string> {
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      title: input.title,
      client_id: input.client_id,
      location: input.location,
      salary_range: input.salary_range,
      min_years: input.min_years,
      status: input.status,
      visa: input.visa as never,
      visa_notes: input.visa_notes,
      requirements: input.requirements,
      description: input.description,
      jd_text: input.jd_text,
    })
    .select("id")
    .single();
  fail("create the job", error);
  const jobId = job!.id;
  if (input.skills.length > 0) {
    const { error: skErr } = await supabase
      .from("job_skills")
      .insert(input.skills.map((s) => ({ job_id: jobId, skill: s.skill, weight: s.weight })));
    fail("save the job's skills", skErr);
  }
  return jobId;
}

export async function sbAddJobNote(
  supabase: SupabaseServerClient,
  jobId: string,
  body: string,
): Promise<{ id: string; created_at: string }> {
  const actorId = await currentProfileId(supabase);
  const { data, error } = await supabase
    .from("job_notes")
    .insert({ job_id: jobId, author_id: actorId, body })
    .select("id, created_at")
    .single();
  fail("add the note", error);
  return { id: data!.id, created_at: data!.created_at };
}

export async function sbGetJobNotes(
  supabase: SupabaseServerClient,
  jobId: string,
): Promise<{ id: string; job_id: string; author_name: string; body: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from("job_notes")
    .select("id, job_id, body, created_at, profiles:author_id(full_name)")
    .eq("job_id", jobId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  fail("load the job notes", error);
  return (data ?? []).map((n) => {
    const profile = n.profiles as { full_name: string } | null;
    return {
      id: n.id,
      job_id: n.job_id,
      author_name: profile?.full_name ?? "Jenny M.",
      body: n.body,
      created_at: n.created_at,
    };
  });
}

/* ------------------------------- templates ------------------------------- */

interface TemplateInput {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

/** The unique-name clash Postgres raises on the `email_templates.name` index. */
function failTemplateName(name: string, error: { code?: string } | null): void {
  if (error?.code === "23505") {
    throw new DataLayerError(
      "VALIDATION",
      `A template named "${name}" already exists — pick a different name.`,
    );
  }
}

/** Insert a new template, or update the existing row when `id` is given. */
export async function sbSaveTemplate(
  supabase: SupabaseServerClient,
  input: TemplateInput & { id: string | null },
): Promise<{ id: string }> {
  const row = {
    name: input.name.trim(),
    category: input.category,
    subject: input.subject,
    body: input.body,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("email_templates")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("id")
      .single();
    failTemplateName(row.name, error);
    fail("save the template", error);
    return { id: data!.id };
  }

  const createdBy = await currentProfileId(supabase);
  const { data, error } = await supabase
    .from("email_templates")
    .insert({ ...row, created_by: createdBy })
    .select("id")
    .single();
  failTemplateName(row.name, error);
  fail("save the template", error);
  return { id: data!.id };
}

/** Soft-delete a template (never hard-delete — the email log references it). */
export async function sbDeleteTemplate(
  supabase: SupabaseServerClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("email_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  fail("delete the template", error);
}

/**
 * Bulk-import templates (e.g. pasted from Gmail). Names already in the library
 * are skipped, so re-importing the same set is safe.
 */
export async function sbImportTemplates(
  supabase: SupabaseServerClient,
  rows: TemplateInput[],
): Promise<{ imported: number; skipped: number }> {
  const { data: existing } = await supabase
    .from("email_templates")
    .select("name")
    .is("archived_at", null);
  const taken = new Set((existing ?? []).map((r) => r.name.trim().toLowerCase()));
  const createdBy = await currentProfileId(supabase);

  let imported = 0;
  let skipped = 0;
  for (const r of rows) {
    const name = r.name.trim();
    const key = name.toLowerCase();
    if (taken.has(key)) {
      skipped++;
      continue;
    }
    const { error } = await supabase
      .from("email_templates")
      .insert({ name, category: r.category, subject: r.subject, body: r.body, created_by: createdBy });
    if (error?.code === "23505") {
      skipped++;
      continue;
    }
    fail("import the template", error);
    taken.add(key);
    imported++;
  }
  return { imported, skipped };
}

/* ----------------------------- sample-data reset ----------------------------- */

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** Loosely-typed view for iterating deletes over table names (no `any`). */
interface DeletableTable {
  delete(): {
    neq(column: string, value: string): Promise<{ error: { message: string; code?: string } | null }>;
  };
}

/**
 * Wipe the seeded sample business data so the workspace starts clean for real
 * use. Children are deleted before parents to respect FK references. Email
 * templates, settings, profiles, AI chat history and notification state are
 * intentionally kept. ⚠️ Run with the service-role client (RLS keeps app roles
 * from hard-deleting candidates — this is a deliberate admin maintenance path).
 */
export async function sbPurgeSampleData(
  admin: SupabaseServerClient,
): Promise<{ candidates: number; jobs: number }> {
  const [{ count: candidates }, { count: jobs }] = await Promise.all([
    admin.from("candidates").select("id", { count: "exact", head: true }),
    admin.from("jobs").select("id", { count: "exact", head: true }),
  ]);

  // FK-safe order: every table has a uuid `id`, so the zero-uuid neq matches
  // all real rows. Cascades may empty some early — re-deleting is harmless.
  const order = [
    "documents",
    "email_log",
    "activity_log",
    "scorecards",
    "interviews",
    "notes",
    "candidate_tags",
    "candidate_skills",
    "candidate_certifications",
    "applications",
    "candidates",
    "job_skills",
    "job_notes",
    "jobs",
    "clients",
  ];
  const db = admin as unknown as { from(table: string): DeletableTable };
  for (const table of order) {
    const { error } = await db.from(table).delete().neq("id", ZERO_UUID);
    fail(`clear sample ${table}`, error);
  }

  return { candidates: candidates ?? 0, jobs: jobs ?? 0 };
}

/* ------------------------------------------------------------------ */
/* TN / USMCA compliance writes (migration 0013)                       */
/* ------------------------------------------------------------------ */

/** Columns the `tn_compliance` table returns (DB-generated cols read-only). */
const TN_COLUMNS =
  "id, application_id, job_title_at_check, tn_eligible, matched_occupation, " +
  "eligibility_confidence, legal_review_required, legal_review_cleared_at, " +
  "legal_review_cleared_by, legal_review_notes, hired_at, employment_ended_at, " +
  "retention_until, created_at, updated_at, archived_at";

/** The signed-in user's candidate_id for an application (for the audit row). */
async function candidateIdForApplication(
  supabase: SupabaseServerClient,
  applicationId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("applications")
    .select("candidate_id")
    .eq("id", applicationId)
    .maybeSingle();
  fail("load the application", error);
  if (!data) throw new DataLayerError("NOT_FOUND", "That application could not be found.");
  return data.candidate_id;
}

/**
 * Upsert the TN eligibility screen result for one application (unique by
 * `application_id`) and log a `compliance` activity row. The result is NOT
 * legal advice — `legal_review_required` carries the attorney-review interlock
 * straight through from lib/tn-eligibility.
 */
export async function sbUpsertTnCompliance(
  supabase: SupabaseServerClient,
  input: {
    application_id: string;
    job_title_at_check: string;
    tn_eligible: boolean;
    matched_occupation: string | null;
    eligibility_confidence: "exact" | "keyword" | "none";
    legal_review_required: boolean;
  },
): Promise<TnComplianceRecord> {
  const actorId = await currentProfileId(supabase);
  const candidateId = await candidateIdForApplication(supabase, input.application_id);

  const { data, error } = await supabase
    .from("tn_compliance")
    .upsert(
      {
        application_id: input.application_id,
        job_title_at_check: input.job_title_at_check,
        tn_eligible: input.tn_eligible,
        matched_occupation: input.matched_occupation,
        eligibility_confidence: input.eligibility_confidence,
        legal_review_required: input.legal_review_required,
      },
      { onConflict: "application_id" },
    )
    .select(TN_COLUMNS)
    .single();
  fail("save the TN eligibility screen", error);

  await writeActivity(
    supabase,
    actorId,
    candidateId,
    "compliance",
    `TN eligibility screened: ${input.tn_eligible ? "may qualify" : "does not qualify"}` +
      `${input.matched_occupation ? ` (${input.matched_occupation})` : ""} — pending legal review`,
  );
  return data as unknown as TnComplianceRecord;
}

/**
 * Clear the legal-review interlock on a TN-compliance record (admin-only — the
 * caller re-checks the role, and RLS still applies). Records the attorney
 * sign-off in a `legal_review` activity row.
 */
export async function sbClearLegalReview(
  supabase: SupabaseServerClient,
  applicationId: string,
  notes: string,
): Promise<TnComplianceRecord> {
  const actorId = await currentProfileId(supabase);
  const candidateId = await candidateIdForApplication(supabase, applicationId);

  const { data, error } = await supabase
    .from("tn_compliance")
    .update({
      legal_review_required: false,
      legal_review_cleared_at: new Date().toISOString(),
      legal_review_cleared_by: actorId,
      legal_review_notes: notes.trim() || null,
    })
    .eq("application_id", applicationId)
    .select(TN_COLUMNS)
    // maybeSingle (not single): zero rows must return null so the guard below
    // fires with a human message instead of a raw PGRST116 error.
    .maybeSingle();
  fail("clear the legal review", error);
  if (!data) {
    throw new DataLayerError(
      "NOT_FOUND",
      "There is no TN screen to clear yet — run the eligibility check first.",
    );
  }

  await writeActivity(
    supabase,
    actorId,
    candidateId,
    "legal_review",
    `Legal review cleared by immigration attorney${notes.trim() ? ` — ${notes.trim()}` : ""}`,
  );
  return data as unknown as TnComplianceRecord;
}

/** Read the TN-compliance record for an application, or null. */
export async function sbGetTnCompliance(
  supabase: SupabaseServerClient,
  applicationId: string,
): Promise<TnComplianceRecord | null> {
  const { data, error } = await supabase
    .from("tn_compliance")
    .select(TN_COLUMNS)
    .eq("application_id", applicationId)
    .is("archived_at", null)
    .maybeSingle();
  fail("load the TN compliance record", error);
  return (data as unknown as TnComplianceRecord | null) ?? null;
}

/** Document categories present (non-archived) for a candidate — for the checklist. */
export async function sbGetCandidateDocCategories(
  supabase: SupabaseServerClient,
  candidateId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("category")
    .eq("candidate_id", candidateId)
    .is("archived_at", null);
  fail("load the candidate's documents", error);
  return (data ?? []).map((d) => d.category as string);
}
