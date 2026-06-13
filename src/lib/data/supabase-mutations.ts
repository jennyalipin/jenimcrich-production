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

  return { id: candidateId, duplicateEmail };
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
