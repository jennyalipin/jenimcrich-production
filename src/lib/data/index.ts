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
import { loadStore, loadCandidatesPageData, loadClients, loadJobsView } from "./supabase-store";
import {
  sbAddNote,
  sbAddScorecard,
  sbCancelInterview,
  sbClearLegalReview,
  sbGetCandidateDocCategories,
  sbGetTnCompliance,
  sbIsSlotTaken,
  sbLogEmail,
  sbMoveStage,
  sbScheduleInterview,
  sbUpdateSettings,
  sbUpsertTnCompliance,
} from "./supabase-mutations";
import { isTnEligible, TN_REQUIRED_DOCS } from "@/lib/tn-eligibility";
import {
  ACTIVE_STAGES,
  DataLayerError,
  isRestrictiveVisa,
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
  type DashboardStalled,
  type DashboardInterview,
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
  type PipelineBoardData,
  type PipelineCard,
  type ScheduleInterviewInput,
  type Scorecard,
  type Settings,
  type SourceStat,
  type Stage,
  type StageTime,
  type StalledApplication,
  type TnChecklistStatus,
  type TnComplianceRecord,
  type TnRequiredDoc,
  type VisaType,
} from "./types";
import { matchScore } from "@/lib/scoring";
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

function emptyStageCounts(): Record<Stage, number> {
  return Object.fromEntries(STAGES.map((st) => [st, 0])) as Record<Stage, number>;
}

/** Apply the list filters + canonical sort, attaching each job's stats. */
function assembleJobs(
  jobs: Job[],
  filters: JobFilters | undefined,
  statsFor: (jobId: string) => Pick<JobWithStats, "applicant_count" | "stage_counts">,
): JobWithStats[] {
  const q = filters?.q?.trim().toLowerCase();
  return jobs
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
    .map((j) => ({ ...clone(j), ...statsFor(j.id) }));
}

/**
 * Jobs with applicant stats. Sorted open → on hold → closed, newest first.
 * Uses a bounded read (jobs + skills + clients + applications) so the listing —
 * and every post-save re-render of it — never hydrates the whole database;
 * falls back to the full store snapshot (demo data, or if the read errors).
 */
export async function getJobs(filters?: JobFilters): Promise<JobWithStats[]> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      const view = await loadJobsView(supabase);
      const stats = new Map<string, { applicant_count: number; stage_counts: Record<Stage, number> }>();
      for (const app of view.applications) {
        if (view.archivedCandidateIds.has(app.candidate_id)) continue; // exclude archived candidates' apps
        const entry = stats.get(app.job_id) ?? { applicant_count: 0, stage_counts: emptyStageCounts() };
        entry.applicant_count += 1;
        entry.stage_counts[app.stage] += 1;
        stats.set(app.job_id, entry);
      }
      return assembleJobs(view.jobs, filters, (id) => stats.get(id) ?? { applicant_count: 0, stage_counts: emptyStageCounts() });
    } catch {
      // Bounded read failed — fall through to the full store snapshot.
    }
  }
  const s = await getStore();
  return assembleJobs(s.jobs, filters, (id) => jobStats(s, id));
}

export async function getJob(id: string): Promise<JobWithStats | null> {
  const s = await getStore();
  const job = s.jobs.find((j) => j.id === id && j.archived_at === null);
  return job ? { ...clone(job), ...jobStats(s, job.id) } : null;
}

export async function getClients(): Promise<Client[]> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      return await loadClients(supabase);
    } catch {
      // fall through to the full store snapshot
    }
  }
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

export interface CandidatesPageResult {
  rows: CandidateWithApplications[];
  total: number;
}

/**
 * Scalable, server-paginated candidate list. On live Supabase it filters +
 * counts in SQL (search_candidates_page RPC) and loads ONLY the page's rows —
 * so it stays cheap at 15k+ candidates, unlike getCandidates() which hydrates
 * the whole store. Falls back to in-memory filter+slice on the demo store.
 */
export async function getCandidatesPage(
  filters: CandidateFilters,
  page: number,
  pageSize: number,
): Promise<CandidatesPageResult> {
  const offset = Math.max(0, (page - 1) * pageSize);
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    const all = await getCandidates(filters);
    return { rows: all.slice(offset, offset + pageSize), total: all.length };
  }

  // search_candidates_page isn't in the generated Database types yet (it lives
  // only in migration 0007), so call it through a narrowly-typed view of the
  // client. NOTE: retype the whole client (not just `.rpc`) and call
  // `sb.rpc(...)` so the method keeps its `this` binding to the client.
  const sb = supabase as unknown as {
    rpc(
      name: "search_candidates_page",
      args: {
        p_q: string | null;
        p_flagged: boolean;
        p_sources: string[] | null;
        p_tags: string[] | null;
        p_stages: string[] | null;
        p_job_ids: string[] | null;
        p_include_archived: boolean;
        p_limit: number;
        p_offset: number;
      },
    ): Promise<{
      data: { id: string; total: number | string }[] | null;
      error: { message: string } | null;
    }>;
  };

  try {
    const { data, error } = await sb.rpc("search_candidates_page", {
      p_q: filters.q?.trim() || null,
      p_flagged: filters.flagged_only ?? false,
      // domain Source is display-cased ("Job Portal"); the DB enum is snake_case.
      p_sources: filters.sources?.length
        ? filters.sources.map((s) => s.toLowerCase().replace(/ /g, "_"))
        : null,
      p_tags: filters.tags?.length ? filters.tags : null,
      p_stages: filters.stages?.length ? filters.stages : null,
      p_job_ids: filters.job_ids?.length ? filters.job_ids : null,
      p_include_archived: filters.include_archived ?? false,
      p_limit: pageSize,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return { rows: [], total: 0 };

    const total = Number(data[0].total);
    const rows = await loadCandidatesPageData(
      supabase,
      data.map((m) => m.id),
    );
    return { rows, total };
  } catch (err) {
    // Never break the list: fall back to the in-memory filter+slice path.
    // Log only the error *name*, never `.message` — a failed query can echo
    // the search term (which may be a candidate email/phone) in its detail.
    console.error("getCandidatesPage scalable path failed; using in-memory fallback:", err instanceof Error ? err.name : "UnknownError");
    const all = await getCandidates(filters);
    return { rows: all.slice(offset, offset + pageSize), total: all.length };
  }
}

/** Distinct tags across all candidates — for the filter sidebar. */
export async function getCandidateTags(): Promise<string[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    const s = await getStore();
    return [...new Set(s.candidates.flatMap((c) => c.tags))].sort();
  }
  const { data } = await supabase.from("candidate_tags").select("tag");
  if (!data) return [];
  return [...new Set(data.map((r) => r.tag))].sort();
}

/** First-seen casing wins; comparison is case-insensitive. */
function dedupeNamesCI(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    const key = n.toLowerCase();
    if (!seen.has(key)) seen.set(key, n);
  }
  return [...seen.values()];
}

/**
 * Distinct candidate skill names — feeds the Jobs page's JD-parser
 * autocomplete dictionary via a single-column query instead of hydrating
 * every candidate (and their applications, notes, …) just for a word list.
 */
export async function getCandidateSkillNames(): Promise<string[]> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from("candidate_skills").select("skill");
      if (error) throw error;
      return dedupeNamesCI((data ?? []).map((r) => r.skill));
    } catch {
      // fall through to the full store snapshot
    }
  }
  const s = await getStore();
  return dedupeNamesCI(s.candidates.flatMap((c) => c.skills.map((sk) => sk.skill)));
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

/** Raw `pipeline_board` RPC payload (migration 0011). */
interface PipelineBoardRpc {
  counts: Partial<Record<Stage, number>>;
  cards: Array<{
    application_id: string;
    candidate_id: string;
    candidate_name: string;
    candidate_flagged: boolean;
    job_id: string;
    job_title: string;
    visa: string;
    score: number;
    stage: Stage;
    days_in_stage: number;
    is_stalled: boolean;
  }>;
}

async function pipelineBoardFromRpc(
  supabase: SupabaseServerClient,
  limitPerStage: number,
): Promise<PipelineBoardData> {
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("stalled_enabled, stalled_days")
    .maybeSingle();
  const stalledEnabled = settingsRow?.stalled_enabled ?? true;
  const stalledDays = settingsRow?.stalled_days ?? 5;

  const sb = supabase as unknown as {
    rpc(
      name: "pipeline_board",
      args: { p_stalled_enabled: boolean; p_stalled_days: number; p_limit_per_stage: number },
    ): Promise<{ data: PipelineBoardRpc | null; error: { message: string } | null }>;
  };
  const { data, error } = await sb.rpc("pipeline_board", {
    p_stalled_enabled: stalledEnabled,
    p_stalled_days: stalledDays,
    p_limit_per_stage: limitPerStage,
  });
  if (error || !data) throw error ?? new Error("pipeline_board returned no data");

  const counts = Object.fromEntries(STAGES.map((st) => [st, data.counts[st] ?? 0])) as Record<
    Stage,
    number
  >;
  const cards: PipelineCard[] = data.cards.map((c) => ({
    applicationId: c.application_id,
    candidateId: c.candidate_id,
    jobId: c.job_id,
    candidateName: c.candidate_name,
    flagged: c.candidate_flagged,
    jobTitle: c.job_title,
    restrictiveVisa: isRestrictiveVisa(c.visa as VisaType),
    score: c.score,
    stage: c.stage,
    daysInStage: c.days_in_stage,
    isStalled: c.is_stalled,
  }));
  return { cards, counts };
}

/**
 * Pipeline board, capped to `limitPerStage` cards per column (with the true
 * per-stage counts) using cached match scores — so the board never loads or
 * re-scores every application. Falls back to the in-memory store.
 */
export async function getPipelineBoard(limitPerStage = 100): Promise<PipelineBoardData> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      return await pipelineBoardFromRpc(supabase, limitPerStage);
    } catch {
      // fall through to the in-memory board below
    }
  }

  const s = await getStore();
  const counts = Object.fromEntries(STAGES.map((st) => [st, 0])) as Record<Stage, number>;
  const grouped: Record<Stage, ApplicationWithRelations[]> = {
    applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [],
  };
  for (const app of liveApplications(s)) {
    counts[app.stage] += 1;
    grouped[app.stage].push(withRelations(s, app));
  }

  const cards: PipelineCard[] = [];
  for (const stage of STAGES) {
    grouped[stage].sort((a, b) => byIsoAsc(a.stage_entered_at, b.stage_entered_at));
    for (const wr of grouped[stage].slice(0, limitPerStage)) {
      cards.push({
        applicationId: wr.id,
        candidateId: wr.candidate_id,
        jobId: wr.job_id,
        candidateName: wr.candidate.full_name,
        flagged: wr.candidate.flagged,
        jobTitle: wr.job.title,
        restrictiveVisa: isRestrictiveVisa(wr.job.visa),
        score: matchScore(toScoreCandidate(wr.candidate), toScoreJob(wr.job)).score,
        stage,
        daysInStage: wr.days_in_stage,
        isStalled: wr.is_stalled,
      });
    }
  }
  return { cards, counts };
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

/** Aggregate payload from the `dashboard_stats` RPC (migration 0010). */
interface DashboardRpc {
  stage_counts: Partial<Record<Stage, number>>;
  active_candidates: number;
  flagged_candidates: number;
  open_jobs: number;
  open_clients: number;
  hired_total: number;
  avg_time_to_hire_days: number;
  stalled_count: number;
  stalled: DashboardStalled[];
}

// DB interview_type enum → domain InterviewType (mirrors supabase-store).
const DASH_INTERVIEW_TYPE: Record<string, DashboardInterview["interview_type"]> = {
  hr_interview: "hr_interview",
  technical: "technical",
  final_panel: "final_panel",
  client_interview: "client_interview",
  phone_screen: "hr_interview",
  panel: "final_panel",
  other: "hr_interview",
};

/**
 * Today's + the next five scheduled interviews. The interviews table has no
 * candidate/interviewer-name columns (candidate is via the application,
 * interviewer via profiles), so we resolve those with bounded id-keyed lookups
 * rather than deep PostgREST embeds.
 */
async function dashboardInterviews(
  supabase: SupabaseServerClient,
  todayStartMs: number,
): Promise<{ todays: DashboardInterview[]; upcoming: DashboardInterview[] }> {
  const { data: ivData, error } = await supabase
    .from("interviews")
    .select("id, application_id, interviewer_id, type, starts_at")
    .eq("status", "scheduled")
    .is("archived_at", null)
    .gte("starts_at", new Date(todayStartMs).toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  const ivs = ivData ?? [];
  if (ivs.length === 0) return { todays: [], upcoming: [] };

  const applicationIds = [...new Set(ivs.map((i) => i.application_id))];
  const interviewerIds = [...new Set(ivs.map((i) => i.interviewer_id).filter((id): id is string => Boolean(id)))];
  const { data: appData } = await supabase
    .from("applications")
    .select("id, candidate_id, stage, job_id")
    .in("id", applicationIds);
  const apps = appData ?? [];

  const candidateIds = [...new Set(apps.map((a) => a.candidate_id))];
  const jobIds = [...new Set(apps.map((a) => a.job_id))];
  const [candRes, jobRes, profRes] = await Promise.all([
    candidateIds.length > 0
      ? supabase.from("candidates").select("id, full_name").in("id", candidateIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    jobIds.length > 0
      ? supabase.from("jobs").select("id, title").in("id", jobIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    interviewerIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", interviewerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const candidateName = new Map((candRes.data ?? []).map((c) => [c.id, c.full_name]));
  const jobTitle = new Map((jobRes.data ?? []).map((j) => [j.id, j.title]));
  const interviewerName = new Map((profRes.data ?? []).map((p) => [p.id, p.full_name]));
  const appInfo = new Map(
    apps.map((a) => [a.id, { candidate_id: a.candidate_id, stage: a.stage as Stage, job_id: a.job_id }]),
  );

  const all: DashboardInterview[] = ivs.map((i) => {
    const app = appInfo.get(i.application_id);
    const candidateId = app?.candidate_id ?? "";
    return {
      id: i.id,
      candidate_id: candidateId,
      candidate_name: candidateName.get(candidateId) ?? "Unknown candidate",
      job_title: (app && jobTitle.get(app.job_id)) || "—",
      interview_type: DASH_INTERVIEW_TYPE[i.type] ?? "hr_interview",
      starts_at: i.starts_at,
      interviewer_name: (i.interviewer_id && interviewerName.get(i.interviewer_id)) || "Interviewer",
      stage: app?.stage ?? "applied",
    };
  });

  const nowMs = readNowMs();
  const todays = all.filter((r) => {
    const t = Date.parse(r.starts_at);
    return t >= todayStartMs && t < todayStartMs + DAY_MS;
  });
  const upcoming = all.filter((r) => Date.parse(r.starts_at) >= nowMs).slice(0, 5);
  return { todays, upcoming };
}

/** Scalable dashboard: aggregates from the RPC, interviews + activity bounded. */
async function dashboardFromRpc(supabase: SupabaseServerClient): Promise<DashboardStats> {
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("stalled_enabled, stalled_days")
    .maybeSingle();
  const stalledEnabled = settingsRow?.stalled_enabled ?? true;
  const stalledDays = settingsRow?.stalled_days ?? 5;
  const todayStart = startOfUtcDayMs(readNowMs());

  const sb = supabase as unknown as {
    rpc(
      name: "dashboard_stats",
      args: { p_stalled_enabled: boolean; p_stalled_days: number; p_stalled_limit: number },
    ): Promise<{ data: DashboardRpc | null; error: { message: string } | null }>;
  };

  const [statsRes, interviews, recent_activity] = await Promise.all([
    sb.rpc("dashboard_stats", {
      p_stalled_enabled: stalledEnabled,
      p_stalled_days: stalledDays,
      p_stalled_limit: 12,
    }),
    dashboardInterviews(supabase, todayStart),
    getActivityFeed(8),
  ]);

  const { data, error } = statsRes;
  if (error || !data) throw error ?? new Error("dashboard_stats returned no data");

  const stage_counts = Object.fromEntries(
    STAGES.map((st) => [st, data.stage_counts[st] ?? 0]),
  ) as Record<Stage, number>;

  return {
    stage_counts,
    active_candidates: data.active_candidates,
    flagged_candidates: data.flagged_candidates,
    open_jobs: data.open_jobs,
    open_clients: data.open_clients,
    hired_total: data.hired_total,
    avg_time_to_hire_days: data.avg_time_to_hire_days,
    stalled_count: data.stalled_count,
    stalled: data.stalled,
    todays_interviews: interviews.todays,
    upcoming_interviews: interviews.upcoming,
    recent_activity,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      return await dashboardFromRpc(supabase);
    } catch {
      // RPC unavailable/failed — fall back to the in-memory path below.
    }
  }

  const s = await getStore();
  const apps = liveApplications(s);

  const stage_counts = Object.fromEntries(STAGES.map((st) => [st, 0])) as Record<Stage, number>;
  for (const app of apps) stage_counts[app.stage] += 1;

  const activeIds = new Set(
    apps.filter((a) => (ACTIVE_STAGES as readonly Stage[]).includes(a.stage)).map((a) => a.candidate_id),
  );
  const openJobs = s.jobs.filter((j) => j.archived_at === null && j.status === "open");

  const stalledFull = await getStalledApplications();
  const stalled: DashboardStalled[] = stalledFull.slice(0, 12).map((a) => ({
    application_id: a.id,
    candidate_id: a.candidate_id,
    candidate_name: a.candidate.full_name,
    candidate_flagged: a.candidate.flagged,
    job_title: a.job.title,
    client_name: a.job.client_name,
    stage: a.stage,
    days_stalled: a.days_stalled,
  }));

  const toDash = (iv: InterviewWithRelations): DashboardInterview => ({
    id: iv.id,
    candidate_id: iv.candidate_id,
    candidate_name: iv.candidate.full_name,
    job_title: iv.job.title,
    interview_type: iv.interview_type,
    starts_at: iv.starts_at,
    interviewer_name: iv.interviewer_name,
    stage: iv.application.stage,
  });

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
    stalled_count: stalledFull.length,
    stalled,
    todays_interviews: todays.map((iv) => toDash(interviewWithRelations(s, iv))),
    upcoming_interviews: scheduled.slice(0, 5).map((iv) => toDash(interviewWithRelations(s, iv))),
    recent_activity: await getActivityFeed(8),
  };
}

/** Raw payload from the `analytics_summary` RPC (migration 0009). */
interface AnalyticsRpc {
  total_candidates: number;
  stage_counts: Partial<Record<Stage, number>>;
  avg_time_to_hire_days: number;
  time_in_stage: Partial<Record<Stage, number>>;
  source_breakdown: { source: string; total: number; qualified: number }[];
  activity_counts: {
    emails_sent: number;
    notes_logged: number;
    scorecards_submitted: number;
    interviews_scheduled: number;
    stalled_now: number;
  };
}

/**
 * Scalable analytics: Postgres aggregates everything (migration 0009) so we
 * never hydrate the whole store. The funnel and conversion percentages are
 * derived in JS from the per-stage counts to keep the rule (rejected apps count
 * toward "Applied" only) next to its sibling logic in the demo path.
 */
async function analyticsFromRpc(supabase: SupabaseServerClient): Promise<AnalyticsData> {
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("stalled_enabled, stalled_days")
    .maybeSingle();
  const stalledEnabled = settingsRow?.stalled_enabled ?? true;
  const stalledDays = settingsRow?.stalled_days ?? 5;

  const sb = supabase as unknown as {
    rpc(
      name: "analytics_summary",
      args: { p_stalled_enabled: boolean; p_stalled_days: number },
    ): Promise<{ data: AnalyticsRpc | null; error: { message: string } | null }>;
  };
  const { data, error } = await sb.rpc("analytics_summary", {
    p_stalled_enabled: stalledEnabled,
    p_stalled_days: stalledDays,
  });
  if (error || !data) throw error ?? new Error("analytics_summary returned no data");

  const sc = data.stage_counts;
  const countOf = (st: Stage): number => sc[st] ?? 0;
  // reached(stage) = apps at that stage or further; rejected counts only at Applied.
  const reached: Record<(typeof PIPELINE_STAGES)[number], number> = {
    applied:
      countOf("applied") +
      countOf("screening") +
      countOf("interview") +
      countOf("offer") +
      countOf("hired") +
      countOf("rejected"),
    screening: countOf("screening") + countOf("interview") + countOf("offer") + countOf("hired"),
    interview: countOf("interview") + countOf("offer") + countOf("hired"),
    offer: countOf("offer") + countOf("hired"),
    hired: countOf("hired"),
  };
  const funnel: FunnelStep[] = PIPELINE_STAGES.map((stage, i) => {
    const count = reached[stage];
    const prev = i === 0 ? count : reached[PIPELINE_STAGES[i - 1]];
    return {
      stage,
      label: STAGE_LABELS[stage],
      count,
      conversion_pct: i === 0 ? 100 : prev > 0 ? Math.round((count / prev) * 100) : 0,
    };
  });

  const offers_extended = countOf("offer") + countOf("hired");
  const offers_accepted = countOf("hired");

  const time_in_stage: StageTime[] = ACTIVE_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    avg_days: data.time_in_stage[stage] ?? 0,
  }));

  // Match each display source to its snake_case DB enum value (same transform
  // as the candidate filters).
  const byDbSource = new Map(data.source_breakdown.map((row) => [row.source, row]));
  const source_breakdown: SourceStat[] = SOURCES.map((source) => {
    const row = byDbSource.get(source.toLowerCase().replace(/ /g, "_"));
    return { source, total: row?.total ?? 0, qualified: row?.qualified ?? 0 };
  });

  return {
    total_candidates: data.total_candidates,
    funnel,
    avg_time_to_hire_days: data.avg_time_to_hire_days,
    offers_extended,
    offers_accepted,
    offer_acceptance_pct: offers_extended ? Math.round((offers_accepted / offers_extended) * 100) : 0,
    interview_to_offer_pct: reached.interview ? Math.round((reached.offer / reached.interview) * 100) : 0,
    time_in_stage,
    source_breakdown,
    activity_counts: { ...data.activity_counts },
  };
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      return await analyticsFromRpc(supabase);
    } catch {
      // RPC unavailable/failed — fall back to the in-memory aggregation below.
    }
  }

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

/** The recent activity feed from only the latest N rows + their names. */
async function activityFeedFromSupabase(
  supabase: SupabaseServerClient,
  limit: number,
): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, candidate_id, actor_id, type, body, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(0, limit));
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const candidateIds = [...new Set(rows.map((r) => r.candidate_id))];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const [candRes, actorRes] = await Promise.all([
    supabase.from("candidates").select("id, full_name").in("id", candidateIds),
    actorIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const candidateName = new Map((candRes.data ?? []).map((c) => [c.id, c.full_name]));
  const actorName = new Map((actorRes.data ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => ({
    id: r.id,
    candidate_id: r.candidate_id,
    type: r.type,
    body: r.body,
    created_at: r.created_at,
    updated_at: r.updated_at,
    actor_name: (r.actor_id && actorName.get(r.actor_id)) || "System",
    candidate_name: candidateName.get(r.candidate_id) ?? "Unknown candidate",
  }));
}

export async function getActivityFeed(limit = 20): Promise<ActivityFeedItem[]> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      return await activityFeedFromSupabase(supabase, limit);
    } catch {
      // fall through to the in-memory feed below
    }
  }

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
/* TN / USMCA compliance (migration 0013)                              */
/* ------------------------------------------------------------------ */

const TN_VISAS: readonly VisaType[] = ["TN_CANADIAN_ONLY", "TN_CANADIAN_OR_MEXICAN"];

/** Build the required-document checklist given the categories on file. */
function buildTnDocs(presentCategories: readonly string[]): TnRequiredDoc[] {
  const present = new Set(presentCategories);
  return TN_REQUIRED_DOCS.map((d) => ({
    category: d.category as TnRequiredDoc["category"],
    label: d.label,
    hint: d.hint,
    present: present.has(d.category),
  }));
}

/**
 * Compose a {@link TnChecklistStatus} from a job title, visa, the persisted
 * record (if any), and the candidate's document categories. The eligibility
 * read prefers the persisted screen; if none exists it computes a live screen
 * from the job title so the panel always has something to show. ALL results
 * remain attorney-gated (lib/tn-eligibility's interlock).
 */
function composeTnChecklist(args: {
  applicationId: string;
  jobTitle: string;
  visa: VisaType;
  record: TnComplianceRecord | null;
  docCategories: readonly string[];
}): TnChecklistStatus {
  const { applicationId, jobTitle, visa, record, docCategories } = args;
  const docs = buildTnDocs(docCategories);
  const allDocsPresent = docs.every((d) => d.present);

  if (record && record.tn_eligible !== null) {
    return {
      applicationId,
      jobTitle,
      visa,
      eligible: record.tn_eligible,
      matchedOccupation: record.matched_occupation,
      confidence: record.eligibility_confidence,
      legalReviewRequired: record.legal_review_required,
      legalReviewClearedAt: record.legal_review_cleared_at,
      legalReviewNotes: record.legal_review_notes,
      docs,
      allDocsPresent,
      record,
    };
  }

  // No persisted screen yet — this is the zero-state. We do NOT surface a
  // computed verdict here (eligible:null → the panel shows "Not screened" and a
  // "Run eligibility check" button); running the check persists a result and the
  // branch above then renders it. legalReviewRequired stays true regardless.
  return {
    applicationId,
    jobTitle,
    visa,
    eligible: null,
    matchedOccupation: null,
    confidence: null,
    legalReviewRequired: true,
    legalReviewClearedAt: record?.legal_review_cleared_at ?? null,
    legalReviewNotes: record?.legal_review_notes ?? null,
    docs,
    allDocsPresent,
    record,
  };
}

/**
 * The TN checklist view-model for an application: eligibility screen + document
 * checklist + legal-review interlock. The Supabase path is wrapped so it never
 * throws if migration 0013 isn't applied yet — it degrades to the live
 * (computed, unsaved) screen with whatever documents are visible. The demo
 * store has no persisted record, so it returns a computed stub (all docs
 * missing) derived from the application's job title.
 */
export async function getTnChecklist(applicationId: string): Promise<TnChecklistStatus | null> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      const s = await freshStore(supabase);
      const app = s.applications.find((a) => a.id === applicationId);
      if (!app) return null;
      const job = s.jobs.find((j) => j.id === app.job_id);
      if (!job) return null;

      // These two reads touch tn_compliance / documents; if 0013 isn't applied
      // the tn_compliance read throws and we fall through to the demo path.
      const [record, docCategories] = await Promise.all([
        sbGetTnCompliance(supabase, applicationId),
        sbGetCandidateDocCategories(supabase, app.candidate_id),
      ]);
      return composeTnChecklist({
        applicationId,
        jobTitle: job.title,
        visa: job.visa,
        record,
        docCategories,
      });
    } catch {
      // 0013 not applied (or a transient read failure): degrade to a safe,
      // computed stub from the in-memory store rather than throwing.
    }
  }

  const s = await getStore();
  const app = s.applications.find((a) => a.id === applicationId);
  if (!app) return null;
  const job = s.jobs.find((j) => j.id === app.job_id);
  if (!job) return null;
  const docCategories = s.documents
    .filter((d) => d.candidate_id === app.candidate_id)
    .map((d) => d.category as string);
  return composeTnChecklist({
    applicationId,
    jobTitle: job.title,
    visa: job.visa,
    record: null,
    docCategories,
  });
}

/** The persisted TN-compliance record for an application, or null. */
export async function getTnComplianceRecord(
  applicationId: string,
): Promise<TnComplianceRecord | null> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      return await sbGetTnCompliance(supabase, applicationId);
    } catch {
      // 0013 not applied yet — there is no record.
    }
  }
  return null;
}

/**
 * Run (and persist) the TN eligibility screen for an application from its
 * current job title. On the demo store there is no persistence layer, so it
 * returns the freshly-computed, unsaved checklist. NOT legal advice — every
 * result stays attorney-gated.
 */
export async function runTnEligibilityCheck(applicationId: string): Promise<TnChecklistStatus> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const pre = await freshStore(supabase);
    const app = pre.applications.find((a) => a.id === applicationId);
    if (!app) throw new DataLayerError("NOT_FOUND", "That application could not be found.");
    const job = pre.jobs.find((j) => j.id === app.job_id);
    if (!job) throw new DataLayerError("NOT_FOUND", "That job could not be found.");

    const screen = isTnEligible(job.title);
    const record = await sbUpsertTnCompliance(supabase, {
      application_id: applicationId,
      job_title_at_check: job.title,
      tn_eligible: screen.eligible,
      matched_occupation: screen.matchedOccupation,
      eligibility_confidence: screen.confidence,
      legal_review_required: screen.legalReviewRequired,
    });
    const docCategories = await sbGetCandidateDocCategories(supabase, app.candidate_id);
    return composeTnChecklist({
      applicationId,
      jobTitle: job.title,
      visa: job.visa,
      record,
      docCategories,
    });
  }

  // Demo store: compute on the fly (no persistence), log a compliance activity.
  const s = db();
  const app = applicationOrThrow(s, applicationId);
  const job = jobOrThrow(s, app.job_id);
  const screen = isTnEligible(job.title);
  appendActivity(
    s,
    app.candidate_id,
    "compliance",
    `TN eligibility screened: ${screen.eligible ? "may qualify" : "does not qualify"}` +
      `${screen.matchedOccupation ? ` (${screen.matchedOccupation})` : ""} — pending legal review`,
    "Jenny M.",
  );
  // Build inline from the store we just mutated — avoid re-entering
  // getTnChecklist()/getStore() (cache()-wrapped) after a write.
  const docCategories = s.documents
    .filter((d) => d.candidate_id === app.candidate_id)
    .map((d) => d.category as string);
  return composeTnChecklist({
    applicationId,
    jobTitle: job.title,
    visa: job.visa,
    record: null,
    docCategories,
  });
}

/**
 * Clear the legal-review interlock on an application's TN screen. Admin-only —
 * the server action re-checks the role; the Supabase RLS update policy is the
 * real gate. On the demo store (no persistence) this logs the sign-off only.
 */
export async function clearTnLegalReview(
  applicationId: string,
  notes: string,
): Promise<TnChecklistStatus> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const record = await sbClearLegalReview(supabase, applicationId, notes);
    const pre = await freshStore(supabase);
    const app = pre.applications.find((a) => a.id === applicationId);
    const job = app ? pre.jobs.find((j) => j.id === app.job_id) : undefined;
    const docCategories = app
      ? await sbGetCandidateDocCategories(supabase, app.candidate_id)
      : [];
    return composeTnChecklist({
      applicationId,
      jobTitle: job?.title ?? record.job_title_at_check ?? "",
      visa: (job?.visa ?? "UNSPECIFIED") as VisaType,
      record,
      docCategories,
    });
  }

  const s = db();
  const app = applicationOrThrow(s, applicationId);
  appendActivity(
    s,
    app.candidate_id,
    "legal_review",
    `Legal review cleared by immigration attorney${notes.trim() ? ` — ${notes.trim()}` : ""}`,
    "Jenny M.",
  );
  const job = s.jobs.find((j) => j.id === app.job_id);
  const docCategories = s.documents
    .filter((d) => d.candidate_id === app.candidate_id)
    .map((d) => d.category as string);
  return composeTnChecklist({
    applicationId,
    jobTitle: job?.title ?? "",
    visa: (job?.visa ?? "UNSPECIFIED") as VisaType,
    record: null,
    docCategories,
  });
}

/** True when an application's job carries a TN visa requirement. */
export function isTnVisa(visa: VisaType): boolean {
  return TN_VISAS.includes(visa);
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
