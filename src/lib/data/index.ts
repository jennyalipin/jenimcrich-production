/**
 * Data access layer for the JeniMcRich ATS — ⚠️ SERVER-ONLY.
 *
 * This is the ONLY import surface pages and server actions may use for data:
 *
 *   import { getJobs, moveApplicationStage, type JobWithStats } from "@/lib/data";
 *
 * Every accessor is async and typed so the in-memory demo store below can be
 * swapped for Supabase queries WITHOUT touching any page — only this file
 * changes. Do not import "./demo-data" from anywhere else.
 *
 * Client components must not import this module (it throws if they do);
 * they may import enums/labels/types from "@/lib/data/types", which is
 * client-safe, and should receive data via props from Server Components.
 *
 * Mutations write to a module-level store kept on `globalThis` so state
 * survives Next.js dev HMR. Reads return deep copies — treat results as
 * snapshots, never mutate them to change state.
 *
 * "Now" semantics: relative computations (days in stage, stalled checks,
 * upcoming interviews) use the fixed REFERENCE_NOW so SSR output is
 * deterministic; mutation timestamps use max(wall clock, REFERENCE_NOW).
 */

import { cache } from "react";
import { daysBetween, formatFullDateTime } from "@/lib/format";
import { getSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createDemoStore, REFERENCE_NOW, type DemoStore } from "./demo-data";
import { loadStore } from "./supabase-store";
import {
  sbAddNote,
  sbAddScorecard,
  sbCancelInterview,
  sbIsSlotTaken,
  sbLogEmail,
  sbMoveStage,
  sbScheduleInterview,
  sbUpdateSettings,
} from "./supabase-mutations";
import {
  ACTIVE_STAGES,
  DataLayerError,
  PIPELINE_STAGES,
  SOURCES,
  STAGES,
  STAGE_LABELS,
  STALLED_DAY_OPTIONS,
  type ActivityFeedItem,
  type ActivityType,
  type AddNoteInput,
  type AddScorecardInput,
  type AnalyticsData,
  type Application,
  type ApplicationWithJob,
  type ApplicationWithRelations,
  type Candidate,
  type CandidateFilters,
  type CandidateProfile,
  type CandidateWithApplications,
  type Client,
  type DashboardStats,
  type EmailLogEntry,
  type EmailTemplate,
  type FunnelStep,
  type Interview,
  type InterviewRange,
  type InterviewWithRelations,
  type Interviewer,
  type Job,
  type JobFilters,
  type JobWithStats,
  type LogEmailInput,
  type Note,
  type ScheduleInterviewInput,
  type Scorecard,
  type Settings,
  type SourceStat,
  type Stage,
  type StageTime,
  type StalledApplication,
} from "./types";
import type { ScoreCandidateInput, ScoreJobInput } from "@/lib/types";

// Re-export the full client-safe type/enum surface plus the reference instant
// so consumers can `import { ... } from "@/lib/data"` for everything.
export * from "./types";
export { REFERENCE_NOW };

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/data is server-only. Pass data to client components via props, or import display constants from @/lib/data/types instead.",
  );
}

/* ------------------------------------------------------------------ */
/* Store (module-level, HMR-stable)                                    */
/* ------------------------------------------------------------------ */

const globalRef = globalThis as typeof globalThis & { __jmrDemoStore?: DemoStore };

function db(): DemoStore {
  return (globalRef.__jmrDemoStore ??= createDemoStore());
}

/**
 * The store every read derives from. When Supabase is configured it is a
 * fresh RLS-scoped snapshot of the live DB; otherwise the in-memory demo
 * store. `cache()` dedupes the hydration across one server render so a page
 * that calls several accessors only loads once. Mutations deliberately call
 * `loadStore` directly (post-write) to bypass this per-request cache.
 */
const getStore = cache(async (): Promise<DemoStore> => {
  const supabase = await getSupabaseServerClient();
  return supabase ? loadStore(supabase) : db();
});

/** Mutations need the live store reflecting their own write — never cached. */
async function freshStore(supabase: SupabaseServerClient): Promise<DemoStore> {
  return loadStore(supabase);
}

/** Restores the pristine demo seed (Settings → "Reset demo data"). */
export async function resetDemoData(): Promise<void> {
  globalRef.__jmrDemoStore = createDemoStore();
}

const NOW_MS = REFERENCE_NOW.getTime();
const DAY_MS = 86_400_000;

/**
 * "Now" for relative reads (days-in-stage, stalled, upcoming/today's
 * interviews). On the live Supabase store rows carry real timestamps, so the
 * math must use the real wall clock; the in-memory demo store is built around
 * the fixed REFERENCE_NOW so SSR output stays deterministic there.
 */
function readNowMs(): number {
  return isSupabaseConfigured() ? Date.now() : NOW_MS;
}

/**
 * "Now" for display formatting in pages (relative times, "as of" labels,
 * days-open). Mirrors {@link readNowMs}: real clock on live Supabase data,
 * the fixed REFERENCE_NOW for the deterministic in-memory demo.
 */
export function displayNow(): Date {
  return isSupabaseConfigured() ? new Date() : REFERENCE_NOW;
}

/** Mutation timestamp (demo path only): never earlier than the reference instant. */
function nowIso(): string {
  return new Date(Math.max(Date.now(), NOW_MS)).toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uid(prefix: string): string {
  const s = db();
  s.seq += 1;
  return `${prefix}-r${s.seq}`;
}

/** Whole days from `iso` to REFERENCE_NOW, clamped ≥ 0. */
function daysAgoOf(iso: string): number {
  return Math.max(0, Math.floor((readNowMs() - Date.parse(iso)) / DAY_MS));
}

/* ------------------------------------------------------------------ */
/* Internal lookups & composition                                      */
/* ------------------------------------------------------------------ */

function jobOrThrow(s: DemoStore, id: string): Job {
  const job = s.jobs.find((j) => j.id === id);
  if (!job) throw new DataLayerError("NOT_FOUND", "That job could not be found. It may have been removed.");
  return job;
}

function candidateOrThrow(s: DemoStore, id: string): Candidate {
  const cand = s.candidates.find((c) => c.id === id);
  if (!cand) throw new DataLayerError("NOT_FOUND", "That candidate could not be found. They may have been archived.");
  return cand;
}

function applicationOrThrow(s: DemoStore, id: string): Application {
  const app = s.applications.find((a) => a.id === id);
  if (!app) throw new DataLayerError("NOT_FOUND", "That application could not be found.");
  return app;
}

function appendActivity(
  s: DemoStore,
  candidate_id: string,
  type: ActivityType,
  body: string,
  actor_name: string,
): void {
  const ts = nowIso();
  s.activity_log.push({ id: uid("act"), candidate_id, actor_name, type, body, created_at: ts, updated_at: ts });
}

/**
 * Last "touch" per domain rule 3: the latest of the application's stage
 * change, any note on the candidate, or any email sent to the candidate.
 * Interviews/scorecards/docs deliberately do NOT reset the stall clock.
 */
function lastTouchMs(s: DemoStore, app: Application): number {
  let last = Date.parse(app.stage_entered_at);
  for (const n of s.notes) {
    if (n.candidate_id === app.candidate_id) last = Math.max(last, Date.parse(n.created_at));
  }
  for (const e of s.email_log) {
    if (e.candidate_id === app.candidate_id) last = Math.max(last, Date.parse(e.sent_at));
  }
  return last;
}

function daysStalledOf(s: DemoStore, app: Application): number {
  return Math.max(0, Math.floor((readNowMs() - lastTouchMs(s, app)) / DAY_MS));
}

function isStalled(s: DemoStore, app: Application, candidate: Candidate): boolean {
  if (!s.settings.stalled_enabled) return false;
  if (candidate.archived_at !== null) return false;
  if (!(ACTIVE_STAGES as readonly Stage[]).includes(app.stage)) return false;
  return daysStalledOf(s, app) >= s.settings.stalled_days;
}

function withJob(s: DemoStore, app: Application): ApplicationWithJob {
  const candidate = candidateOrThrow(s, app.candidate_id);
  return {
    ...clone(app),
    job: clone(jobOrThrow(s, app.job_id)),
    days_in_stage: daysAgoOf(app.stage_entered_at),
    is_stalled: isStalled(s, app, candidate),
  };
}

function withRelations(s: DemoStore, app: Application): ApplicationWithRelations {
  return { ...withJob(s, app), candidate: clone(candidateOrThrow(s, app.candidate_id)) };
}

function toStalled(s: DemoStore, app: Application): StalledApplication {
  return { ...withRelations(s, app), days_stalled: daysStalledOf(s, app) };
}

/** Applications whose candidate is not archived (the default visibility). */
function liveApplications(s: DemoStore): Application[] {
  const archived = new Set(s.candidates.filter((c) => c.archived_at !== null).map((c) => c.id));
  return s.applications.filter((a) => !archived.has(a.candidate_id));
}

function interviewWithRelations(s: DemoStore, iv: Interview): InterviewWithRelations {
  const app = applicationOrThrow(s, iv.application_id);
  return {
    ...clone(iv),
    candidate: clone(candidateOrThrow(s, iv.candidate_id)),
    job: clone(jobOrThrow(s, app.job_id)),
    application: clone(app),
  };
}

const byIsoAsc = (a: string, b: string): number => Date.parse(a) - Date.parse(b);
const byIsoDesc = (a: string, b: string): number => Date.parse(b) - Date.parse(a);

/* ------------------------------------------------------------------ */
/* Jobs & clients                                                      */
/* ------------------------------------------------------------------ */

function jobStats(s: DemoStore, jobId: string): Pick<JobWithStats, "applicant_count" | "stage_counts"> {
  const stage_counts = Object.fromEntries(STAGES.map((st) => [st, 0])) as Record<Stage, number>;
  let applicant_count = 0;
  for (const app of liveApplications(s)) {
    if (app.job_id !== jobId) continue;
    applicant_count += 1;
    stage_counts[app.stage] += 1;
  }
  return { applicant_count, stage_counts };
}

const JOB_STATUS_ORDER: Record<Job["status"], number> = { open: 0, on_hold: 1, closed: 2 };

/** Jobs with applicant stats. Sorted open → on hold → closed, newest first. */
export async function getJobs(filters?: JobFilters): Promise<JobWithStats[]> {
  const s = await getStore();
  const q = filters?.q?.trim().toLowerCase();
  return s.jobs
    .filter((j) => j.archived_at === null)
    .filter((j) => (filters?.status ? j.status === filters.status : true))
    .filter((j) => (filters?.client_id ? j.client_id === filters.client_id : true))
    .filter((j) => (filters?.visa ? j.visa === filters.visa : true))
    .filter((j) =>
      q
        ? [j.title, j.client_name, j.location, ...j.skills.map((sk) => sk.skill)]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true,
    )
    .sort(
      (a, b) =>
        JOB_STATUS_ORDER[a.status] - JOB_STATUS_ORDER[b.status] || byIsoDesc(a.opened_at, b.opened_at),
    )
    .map((j) => ({ ...clone(j), ...jobStats(s, j.id) }));
}

export async function getJob(id: string): Promise<JobWithStats | null> {
  const s = await getStore();
  const job = s.jobs.find((j) => j.id === id && j.archived_at === null);
  return job ? { ...clone(job), ...jobStats(s, job.id) } : null;
}

export async function getClients(): Promise<Client[]> {
  return clone((await getStore()).clients);
}

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

function candidateApplications(s: DemoStore, candidateId: string): ApplicationWithJob[] {
  return s.applications
    .filter((a) => a.candidate_id === candidateId)
    .sort((a, b) => byIsoDesc(a.applied_at, b.applied_at))
    .map((a) => withJob(s, a));
}

/** Candidates with their applications+jobs attached. Seed order is stable. */
export async function getCandidates(filters?: CandidateFilters): Promise<CandidateWithApplications[]> {
  const s = await getStore();
  const q = filters?.q?.trim().toLowerCase();

  return s.candidates
    .filter((c) => (filters?.include_archived ? true : c.archived_at === null))
    .filter((c) => (filters?.flagged_only ? c.flagged : true))
    .filter((c) => (filters?.sources?.length ? filters.sources.includes(c.source) : true))
    .filter((c) => (filters?.tags?.length ? filters.tags.some((t) => c.tags.includes(t)) : true))
    .filter((c) => {
      if (!filters?.stages?.length && !filters?.job_ids?.length) return true;
      const apps = s.applications.filter((a) => a.candidate_id === c.id);
      const stageOk = filters.stages?.length ? apps.some((a) => filters.stages?.includes(a.stage)) : true;
      const jobOk = filters.job_ids?.length ? apps.some((a) => filters.job_ids?.includes(a.job_id)) : true;
      return stageOk && jobOk;
    })
    .filter((c) =>
      q
        ? [
            c.full_name,
            c.email,
            c.location,
            c.summary,
            c.resume_text,
            ...c.skills.map((sk) => sk.skill),
            ...c.certifications,
            ...c.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true,
    )
    .map((c) => ({ ...clone(c), applications: candidateApplications(s, c.id) }));
}

/** Full profile for the candidate detail page (all tabs in one call). */
export async function getCandidate(id: string): Promise<CandidateProfile | null> {
  const s = await getStore();
  const cand = s.candidates.find((c) => c.id === id);
  if (!cand) return null;
  return {
    ...clone(cand),
    applications: candidateApplications(s, cand.id),
    notes: clone(s.notes.filter((n) => n.candidate_id === id)).sort((a, b) => byIsoDesc(a.created_at, b.created_at)),
    scorecards: clone(s.scorecards.filter((sc) => sc.candidate_id === id)).sort((a, b) => byIsoDesc(a.created_at, b.created_at)),
    interviews: clone(s.interviews.filter((iv) => iv.candidate_id === id)).sort((a, b) => byIsoAsc(a.starts_at, b.starts_at)),
    documents: clone(s.documents.filter((d) => d.candidate_id === id)).sort((a, b) => byIsoDesc(a.created_at, b.created_at)),
    emails: clone(s.email_log.filter((e) => e.candidate_id === id)).sort((a, b) => byIsoDesc(a.sent_at, b.sent_at)),
    activity: clone(s.activity_log.filter((a) => a.candidate_id === id)).sort((a, b) => byIsoDesc(a.created_at, b.created_at)),
  };
}

/* ------------------------------------------------------------------ */
/* Applications & pipeline                                             */
/* ------------------------------------------------------------------ */

export async function getApplication(id: string): Promise<ApplicationWithRelations | null> {
  const s = await getStore();
  const app = s.applications.find((a) => a.id === id);
  return app ? withRelations(s, app) : null;
}

/** Kanban feed: every stage (incl. hired/rejected), oldest-in-stage first. */
export async function getApplicationsByStage(): Promise<Record<Stage, ApplicationWithRelations[]>> {
  const s = await getStore();
  const result: Record<Stage, ApplicationWithRelations[]> = {
    applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [],
  };
  for (const app of liveApplications(s)) {
    result[app.stage].push(withRelations(s, app));
  }
  for (const stage of STAGES) {
    result[stage].sort((a, b) => byIsoAsc(a.stage_entered_at, b.stage_entered_at));
  }
  return result;
}

export async function getApplicationsForJob(jobId: string): Promise<ApplicationWithRelations[]> {
  const s = await getStore();
  jobOrThrow(s, jobId);
  return liveApplications(s)
    .filter((a) => a.job_id === jobId)
    .sort((a, b) => byIsoDesc(a.applied_at, b.applied_at))
    .map((a) => withRelations(s, a));
}

export async function getApplicationsForCandidate(candidateId: string): Promise<ApplicationWithJob[]> {
  const s = await getStore();
  candidateOrThrow(s, candidateId);
  return candidateApplications(s, candidateId);
}

/**
 * Moves an application to a new stage (domain rule 1): updates
 * `stage_entered_at` and appends to the activity log. No-op if unchanged.
 */
export async function moveApplicationStage(
  applicationId: string,
  stage: Stage,
  actorName = "Jenny M.",
): Promise<ApplicationWithRelations> {
  if (!STAGES.includes(stage)) {
    throw new DataLayerError("VALIDATION", `"${String(stage)}" is not a valid pipeline stage.`);
  }
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await sbMoveStage(supabase, applicationId, stage);
    const s = await freshStore(supabase);
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new DataLayerError("NOT_FOUND", "That application could not be found.");
    return withRelations(s, app);
  }
  const s = db();
  const app = applicationOrThrow(s, applicationId);
  if (app.stage !== stage) {
    const job = jobOrThrow(s, app.job_id);
    app.stage = stage;
    app.stage_entered_at = nowIso();
    app.updated_at = app.stage_entered_at;
    appendActivity(s, app.candidate_id, "stage", `Moved to ${STAGE_LABELS[stage]} · ${job.title}`, actorName);
  }
  return withRelations(s, app);
}

/* ------------------------------------------------------------------ */
/* Notes & scorecards                                                  */
/* ------------------------------------------------------------------ */

export async function addNote(input: AddNoteInput): Promise<Note> {
  const body = input.body.trim();
  if (!body) throw new DataLayerError("VALIDATION", "The note text cannot be empty.");
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const id = await sbAddNote(supabase, { ...input, body });
    const s = await freshStore(supabase);
    const note = s.notes.find((n) => n.id === id);
    if (!note) throw new DataLayerError("VALIDATION", "The note was saved but could not be re-read.");
    return note;
  }
  const s = db();
  candidateOrThrow(s, input.candidate_id);

  const ts = nowIso();
  const note: Note = {
    id: uid("n"),
    candidate_id: input.candidate_id,
    author_name: input.author_name ?? "Jenny M.",
    category: input.category,
    body,
    created_at: ts,
    updated_at: ts,
  };
  s.notes.push(note);
  appendActivity(s, note.candidate_id, "note", "Note added", note.author_name);
  return clone(note);
}

export async function getNotes(candidateId: string): Promise<Note[]> {
  const s = await getStore();
  return clone(s.notes.filter((n) => n.candidate_id === candidateId)).sort((a, b) =>
    byIsoDesc(a.created_at, b.created_at),
  );
}

export async function addScorecard(input: AddScorecardInput): Promise<Scorecard> {
  if (!input.summary.trim()) {
    throw new DataLayerError("VALIDATION", "A scorecard needs a written summary.");
  }
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const pre = await freshStore(supabase);
    const app = pre.applications.find((a) => a.id === input.application_id);
    if (!app) throw new DataLayerError("NOT_FOUND", "That application could not be found.");
    const interviewer = pre.interviewers.find((u) => u.id === input.interviewer_id);
    if (!interviewer) throw new DataLayerError("NOT_FOUND", "That interviewer could not be found.");
    const id = await sbAddScorecard(supabase, input, app.candidate_id, interviewer.name);
    const s = await freshStore(supabase);
    const scorecard = s.scorecards.find((sc) => sc.id === id);
    if (!scorecard) throw new DataLayerError("VALIDATION", "The scorecard was saved but could not be re-read.");
    return scorecard;
  }
  const s = db();
  const app = applicationOrThrow(s, input.application_id);
  const interviewer = s.interviewers.find((u) => u.id === input.interviewer_id);
  if (!interviewer) throw new DataLayerError("NOT_FOUND", "That interviewer could not be found.");

  const ts = nowIso();
  const scorecard: Scorecard = {
    id: uid("sc"),
    application_id: app.id,
    candidate_id: app.candidate_id,
    interviewer_id: interviewer.id,
    interviewer_name: interviewer.name,
    ratings: { ...input.ratings },
    summary: input.summary.trim(),
    recommendation: input.recommendation,
    created_at: ts,
    updated_at: ts,
  };
  s.scorecards.push(scorecard);
  appendActivity(s, app.candidate_id, "scorecard", `Scorecard submitted — ${interviewer.name}`, interviewer.name);
  return clone(scorecard);
}

/* ------------------------------------------------------------------ */
/* Email templates & log                                               */
/* ------------------------------------------------------------------ */

/** Raw templates — merge-field rendering belongs to "@/lib/merge". */
export async function getTemplates(): Promise<EmailTemplate[]> {
  return clone((await getStore()).templates);
}

export async function getTemplate(id: string): Promise<EmailTemplate | null> {
  const t = (await getStore()).templates.find((tpl) => tpl.id === id);
  return t ? clone(t) : null;
}

/**
 * Records a sent email in `email_log` AND the candidate's activity log
 * (domain rule 6). Demo layer only logs — Resend wiring comes later.
 */
export async function logEmail(input: LogEmailInput): Promise<EmailLogEntry> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const pre = await freshStore(supabase);
    const cand = pre.candidates.find((c) => c.id === input.candidate_id);
    if (!cand) throw new DataLayerError("NOT_FOUND", "That candidate could not be found.");
    const id = await sbLogEmail(supabase, input, input.to_email ?? cand.email);
    const s = await freshStore(supabase);
    const entry = s.email_log.find((e) => e.id === id);
    if (!entry) throw new DataLayerError("VALIDATION", "The email was logged but could not be re-read.");
    return entry;
  }
  const s = db();
  const cand = candidateOrThrow(s, input.candidate_id);
  const ts = nowIso();
  const entry: EmailLogEntry = {
    id: uid("e"),
    candidate_id: cand.id,
    template_id: input.template_id ?? null,
    to_email: input.to_email ?? cand.email,
    subject: input.subject,
    status: input.status ?? "sent",
    sent_at: ts,
    created_at: ts,
    updated_at: ts,
  };
  s.email_log.push(entry);
  appendActivity(s, cand.id, "email", `Email sent: ${entry.subject}`, input.actor_name ?? "Jenny M.");
  return clone(entry);
}

export async function getEmailLog(candidateId?: string): Promise<EmailLogEntry[]> {
  const s = await getStore();
  return clone(candidateId ? s.email_log.filter((e) => e.candidate_id === candidateId) : s.email_log).sort(
    (a, b) => byIsoDesc(a.sent_at, b.sent_at),
  );
}

/* ------------------------------------------------------------------ */
/* Interviews & scheduling                                             */
/* ------------------------------------------------------------------ */

export async function getInterviewers(): Promise<Interviewer[]> {
  return clone((await getStore()).interviewers);
}

/** Interviews joined with candidate/job/application, sorted by start time. */
export async function getInterviews(range?: InterviewRange): Promise<InterviewWithRelations[]> {
  const s = await getStore();
  const fromMs = range?.from ? Date.parse(range.from) : Number.NEGATIVE_INFINITY;
  const toMs = range?.to ? Date.parse(range.to) : Number.POSITIVE_INFINITY;
  return s.interviews
    .filter((iv) => {
      const t = Date.parse(iv.starts_at);
      return t >= fromMs && t < toMs;
    })
    .filter((iv) => (range?.interviewer_id ? iv.interviewer_id === range.interviewer_id : true))
    .filter((iv) => (range?.status ? iv.status === range.status : true))
    .sort((a, b) => byIsoAsc(a.starts_at, b.starts_at))
    .map((iv) => interviewWithRelations(s, iv));
}

/**
 * True if the interviewer already has a *scheduled* interview at exactly
 * this instant (slot model matches the prototype's slot picker).
 */
export async function isSlotTaken(interviewerId: string, startsAt: string): Promise<boolean> {
  const t = Date.parse(startsAt);
  if (Number.isNaN(t)) {
    throw new DataLayerError("VALIDATION", "That interview time is not a valid date.");
  }
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    return sbIsSlotTaken(supabase, interviewerId, new Date(t).toISOString());
  }
  return db().interviews.some(
    (iv) => iv.interviewer_id === interviewerId && iv.status === "scheduled" && Date.parse(iv.starts_at) === t,
  );
}

/**
 * Books an interview slot. Rejects double-booking the interviewer
 * (domain rule 5) with a human-readable SLOT_TAKEN error. Also logs a
 * confirmation email + activity entry, mirroring the prototype.
 */
export async function scheduleInterview(input: ScheduleInterviewInput): Promise<InterviewWithRelations> {
  if (Number.isNaN(Date.parse(input.starts_at))) {
    throw new DataLayerError("VALIDATION", "That interview time is not a valid date.");
  }
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const pre = await freshStore(supabase);
    const app = pre.applications.find((a) => a.id === input.application_id);
    if (!app) throw new DataLayerError("NOT_FOUND", "That application could not be found.");
    const interviewer = pre.interviewers.find((u) => u.id === input.interviewer_id);
    if (!interviewer) throw new DataLayerError("NOT_FOUND", "That interviewer could not be found.");
    const slotMsg = `${interviewer.name} is already booked at ${formatFullDateTime(input.starts_at)} (UTC). Please pick a different slot.`;
    if (await isSlotTaken(interviewer.id, input.starts_at)) {
      throw new DataLayerError("SLOT_TAKEN", slotMsg);
    }
    const id = await sbScheduleInterview(supabase, input, app.candidate_id, interviewer.name, slotMsg);
    // Confirmation email is part of the booking flow (rule 6: log to both).
    await logEmail({
      candidate_id: app.candidate_id,
      subject: `Interview Confirmation – ${formatFullDateTime(new Date(Date.parse(input.starts_at)).toISOString())} (UTC)`,
      status: "sent",
    });
    const s = await freshStore(supabase);
    const iv = s.interviews.find((x) => x.id === id);
    if (!iv) throw new DataLayerError("VALIDATION", "The interview was booked but could not be re-read.");
    return interviewWithRelations(s, iv);
  }
  const s = db();
  const app = applicationOrThrow(s, input.application_id);
  const interviewer = s.interviewers.find((u) => u.id === input.interviewer_id);
  if (!interviewer) throw new DataLayerError("NOT_FOUND", "That interviewer could not be found.");
  if (await isSlotTaken(interviewer.id, input.starts_at)) {
    throw new DataLayerError(
      "SLOT_TAKEN",
      `${interviewer.name} is already booked at ${formatFullDateTime(input.starts_at)} (UTC). Please pick a different slot.`,
    );
  }

  const cand = candidateOrThrow(s, app.candidate_id);
  const ts = nowIso();
  const interview: Interview = {
    id: uid("iv"),
    application_id: app.id,
    candidate_id: app.candidate_id,
    interviewer_id: interviewer.id,
    interviewer_name: interviewer.name,
    starts_at: new Date(Date.parse(input.starts_at)).toISOString(),
    duration_minutes: input.duration_minutes ?? 60,
    interview_type: input.interview_type,
    status: "scheduled",
    created_at: ts,
    updated_at: ts,
  };
  s.interviews.push(interview);
  appendActivity(
    s,
    app.candidate_id,
    "interview",
    `Interview booked: ${formatFullDateTime(interview.starts_at)} (UTC) with ${interviewer.name} — confirmations sent`,
    "Jenny M.",
  );
  // Confirmation email is part of the booking flow (rule 6: log to both).
  await logEmail({
    candidate_id: cand.id,
    subject: `Interview Confirmation – ${formatFullDateTime(interview.starts_at)} (UTC)`,
    status: "sent",
  });
  return interviewWithRelations(s, interview);
}

export async function cancelInterview(id: string): Promise<Interview> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const pre = await freshStore(supabase);
    const target = pre.interviews.find((x) => x.id === id);
    if (!target) throw new DataLayerError("NOT_FOUND", "That interview could not be found.");
    if (target.status === "scheduled") {
      await sbCancelInterview(supabase, id, target.candidate_id, target.interviewer_name);
    }
    const s = await freshStore(supabase);
    const iv = s.interviews.find((x) => x.id === id);
    return iv ?? target;
  }
  const s = db();
  const iv = s.interviews.find((x) => x.id === id);
  if (!iv) throw new DataLayerError("NOT_FOUND", "That interview could not be found.");
  if (iv.status === "scheduled") {
    iv.status = "cancelled";
    iv.updated_at = nowIso();
    appendActivity(s, iv.candidate_id, "interview", `Interview cancelled (${iv.interviewer_name})`, "Jenny M.");
  }
  return clone(iv);
}

/* ------------------------------------------------------------------ */
/* Stalled candidates (domain rule 3)                                  */
/* ------------------------------------------------------------------ */

/** Applications with no stage move / note / email in ≥ N days, worst first. */
export async function getStalledApplications(): Promise<StalledApplication[]> {
  const s = await getStore();
  return liveApplications(s)
    .filter((app) => isStalled(s, app, candidateOrThrow(s, app.candidate_id)))
    .map((app) => toStalled(s, app))
    .sort((a, b) => b.days_stalled - a.days_stalled);
}

/* ------------------------------------------------------------------ */
/* Dashboard & analytics                                               */
/* ------------------------------------------------------------------ */

function startOfUtcDayMs(ms: number): number {
  return ms - (ms % DAY_MS);
}

function avgDaysToHire(s: DemoStore): number {
  const hired = liveApplications(s).filter((a) => a.stage === "hired");
  if (hired.length === 0) return 0;
  const total = hired.reduce((sum, a) => sum + Math.max(0, daysBetween(a.applied_at, a.stage_entered_at)), 0);
  return Math.round(total / hired.length);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const s = await getStore();
  const apps = liveApplications(s);

  const stage_counts = Object.fromEntries(STAGES.map((st) => [st, 0])) as Record<Stage, number>;
  for (const app of apps) stage_counts[app.stage] += 1;

  const activeIds = new Set(
    apps.filter((a) => (ACTIVE_STAGES as readonly Stage[]).includes(a.stage)).map((a) => a.candidate_id),
  );
  const openJobs = s.jobs.filter((j) => j.archived_at === null && j.status === "open");

  const stalled = await getStalledApplications();

  const scheduled = s.interviews
    .filter((iv) => iv.status === "scheduled" && Date.parse(iv.starts_at) >= readNowMs())
    .sort((a, b) => byIsoAsc(a.starts_at, b.starts_at));
  const todayStart = startOfUtcDayMs(readNowMs());
  const todays = s.interviews.filter((iv) => {
    const t = Date.parse(iv.starts_at);
    return iv.status === "scheduled" && t >= todayStart && t < todayStart + DAY_MS;
  });

  return {
    stage_counts,
    active_candidates: activeIds.size,
    flagged_candidates: s.candidates.filter((c) => c.archived_at === null && c.flagged).length,
    open_jobs: openJobs.length,
    open_clients: new Set(openJobs.map((j) => j.client_id)).size,
    hired_total: stage_counts.hired,
    avg_time_to_hire_days: avgDaysToHire(s),
    stalled_count: stalled.length,
    stalled,
    todays_interviews: todays.map((iv) => interviewWithRelations(s, iv)),
    upcoming_interviews: scheduled.slice(0, 5).map((iv) => interviewWithRelations(s, iv)),
    recent_activity: await getActivityFeed(8),
  };
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const s = await getStore();
  const apps = liveApplications(s);

  // Funnel: count applications that reached each stage or further;
  // rejected applications count toward "Applied" only (prototype rule).
  const stageIndex = new Map<Stage, number>(STAGES.map((st, i) => [st, i]));
  const reached = (idx: number): number =>
    apps.filter((a) => {
      if (a.stage === "rejected") return idx === 0;
      return (stageIndex.get(a.stage) ?? 0) >= idx;
    }).length;

  const funnel: FunnelStep[] = PIPELINE_STAGES.map((stage, i) => {
    const count = reached(i);
    const prev = i === 0 ? count : reached(i - 1);
    return {
      stage,
      label: STAGE_LABELS[stage],
      count,
      conversion_pct: i === 0 ? 100 : prev > 0 ? Math.round((count / prev) * 100) : 0,
    };
  });

  const offers_extended = apps.filter((a) => a.stage === "offer" || a.stage === "hired").length;
  const offers_accepted = apps.filter((a) => a.stage === "hired").length;
  const interviewReached = funnel[2]?.count ?? 0;
  const offerReached = funnel[3]?.count ?? 0;

  const time_in_stage: StageTime[] = ACTIVE_STAGES.map((stage) => {
    const inStage = apps.filter((a) => a.stage === stage);
    const avg = inStage.length
      ? Math.round(inStage.reduce((sum, a) => sum + daysAgoOf(a.stage_entered_at), 0) / inStage.length)
      : 0;
    return { stage, label: STAGE_LABELS[stage], avg_days: avg };
  });

  const liveCandidates = s.candidates.filter((c) => c.archived_at === null);
  const qualifiedStages: readonly Stage[] = ["interview", "offer", "hired"];
  const source_breakdown: SourceStat[] = SOURCES.map((source) => {
    const fromSource = liveCandidates.filter((c) => c.source === source);
    const qualified = fromSource.filter((c) =>
      s.applications.some((a) => a.candidate_id === c.id && qualifiedStages.includes(a.stage)),
    ).length;
    return { source, total: fromSource.length, qualified };
  });

  const stalled = await getStalledApplications();

  return {
    total_candidates: liveCandidates.length,
    funnel,
    avg_time_to_hire_days: avgDaysToHire(s),
    offers_extended,
    offers_accepted,
    offer_acceptance_pct: offers_extended ? Math.round((offers_accepted / offers_extended) * 100) : 0,
    interview_to_offer_pct: interviewReached ? Math.round((offerReached / interviewReached) * 100) : 0,
    time_in_stage,
    source_breakdown,
    activity_counts: {
      emails_sent: s.email_log.length,
      notes_logged: s.notes.length,
      scorecards_submitted: s.scorecards.length,
      interviews_scheduled: s.interviews.length,
      stalled_now: stalled.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Activity feed & settings                                            */
/* ------------------------------------------------------------------ */

export async function getActivityFeed(limit = 20): Promise<ActivityFeedItem[]> {
  const s = await getStore();
  const names = new Map(s.candidates.map((c) => [c.id, c.full_name]));
  return clone(
    [...s.activity_log]
      .sort((a, b) => byIsoDesc(a.created_at, b.created_at))
      .slice(0, Math.max(0, limit))
      .map((entry) => ({ ...entry, candidate_name: names.get(entry.candidate_id) ?? "Unknown candidate" })),
  );
}

export async function getSettings(): Promise<Settings> {
  return clone((await getStore()).settings);
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const s = db();
  if (patch.stalled_days !== undefined && !STALLED_DAY_OPTIONS.includes(patch.stalled_days)) {
    throw new DataLayerError(
      "VALIDATION",
      `The stalled-candidate threshold must be one of ${STALLED_DAY_OPTIONS.join(", ")} days.`,
    );
  }
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await sbUpdateSettings(supabase, patch);
    return (await freshStore(supabase)).settings;
  }
  if (patch.stalled_days !== undefined) s.settings.stalled_days = patch.stalled_days;
  if (patch.stalled_enabled !== undefined) s.settings.stalled_enabled = patch.stalled_enabled;
  return clone(s.settings);
}

/* ------------------------------------------------------------------ */
/* Scoring adapters                                                    */
/* ------------------------------------------------------------------ */

/** Maps a data-layer candidate to the shape `@/lib/scoring` expects. */
export function toScoreCandidate(c: Pick<Candidate, "full_name" | "years_exp" | "skills" | "certifications">): ScoreCandidateInput {
  return { name: c.full_name, yearsExp: c.years_exp, skills: c.skills, certifications: c.certifications };
}

/** Maps a data-layer job to the shape `@/lib/scoring` expects. */
export function toScoreJob(j: Pick<Job, "min_years" | "skills">): ScoreJobInput {
  return { minYears: j.min_years, skills: j.skills };
}
