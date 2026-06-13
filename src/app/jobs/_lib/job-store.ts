/**
 * Demo-mode overlay store for the Jobs area — jobs created through the
 * "New job" flow plus hiring-manager job notes.
 *
 * The shared demo data layer (src/lib/data) is read-only for jobs today: it
 * exposes no createJob / job-notes functions (those arrive with the Supabase
 * swap — the `jobs` and `job_notes` tables already exist in the migrations).
 * Until then this module keeps the records in-memory, following the data
 * layer's conventions exactly: server-only, async, deep-copied snapshots,
 * globalThis-stable across dev HMR, timestamps clamped to REFERENCE_NOW.
 *
 * Swap plan: replace each function body with a Supabase query; callers
 * (server actions + the /jobs pages) do not change.
 */

import {
  REFERENCE_NOW_ISO,
  STAGES,
  type JobSkill,
  type JobStatus,
  type JobWithStats,
  type Stage,
  type VisaType,
} from "@/lib/data/types";

if (typeof window !== "undefined") {
  throw new Error(
    "job-store is server-only. Mutate it through the server actions in src/app/jobs/actions.ts.",
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** Hiring-manager note on a job (mirrors the `job_notes` table). */
export interface JobNote {
  id: string;
  job_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

/** Validated input for a new listing (client already resolved by the action). */
export interface LocalJobInput {
  title: string;
  client_id: string;
  client_name: string;
  location: string;
  salary_range: string;
  min_years: number;
  status: JobStatus;
  visa: VisaType;
  visa_notes: string | null;
  skills: JobSkill[];
  requirements: string[];
  description: string;
  jd_text: string;
}

interface JobOverlayStore {
  seq: number;
  jobs: JobWithStats[];
  notesByJob: Record<string, JobNote[]>;
}

/* ------------------------------------------------------------------ */
/* Store (module-level, HMR-stable)                                     */
/* ------------------------------------------------------------------ */

const REFERENCE_NOW_MS = Date.parse(REFERENCE_NOW_ISO);
const DAY_MS = 86_400_000;

/** Mutation timestamp: never earlier than the demo reference instant. */
function nowIso(): string {
  return new Date(Math.max(Date.now(), REFERENCE_NOW_MS)).toISOString();
}

function daysBeforeIso(days: number): string {
  return new Date(REFERENCE_NOW_MS - days * DAY_MS).toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** A few seeded HM notes so the job-detail panel demos well (j1 = Plant
 *  Manager at Helix Cement, j7 = the TN-restricted Lonestar Cement role). */
function seedNotes(): Record<string, JobNote[]> {
  return {
    j1: [
      {
        id: "jn2",
        job_id: "j1",
        author_name: "Jenny M.",
        body: "Budget approved up to ₱250k/mo for an exceptional profile — confirmed with Liza on this week's client call.",
        created_at: daysBeforeIso(3),
      },
      {
        id: "jn1",
        job_id: "j1",
        author_name: "Liza Manalo",
        body: "HM now prefers candidates with hands-on kiln optimization experience; pure ops managers are a harder sell.",
        created_at: daysBeforeIso(9),
      },
    ],
    j7: [
      {
        id: "jn3",
        job_id: "j7",
        author_name: "Dale Whitfield",
        body: "Reminder: TN status means Canadian citizens only for this role. Please confirm work authorization before submitting profiles.",
        created_at: daysBeforeIso(6),
      },
    ],
  };
}

const globalRef = globalThis as typeof globalThis & {
  __jmrJobOverlay?: JobOverlayStore;
};

function store(): JobOverlayStore {
  return (globalRef.__jmrJobOverlay ??= {
    seq: 0,
    jobs: [],
    notesByJob: seedNotes(),
  });
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                 */
/* ------------------------------------------------------------------ */

/** Jobs created in this demo session (newest first). */
export async function listLocalJobs(): Promise<JobWithStats[]> {
  return clone(store().jobs);
}

export async function getLocalJob(id: string): Promise<JobWithStats | null> {
  const job = store().jobs.find((j) => j.id === id);
  return job ? clone(job) : null;
}

export async function createLocalJob(input: LocalJobInput): Promise<JobWithStats> {
  const s = store();
  s.seq += 1;
  const ts = nowIso();
  const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<
    Stage,
    number
  >;
  const job: JobWithStats = {
    id: `local-j${s.seq}`,
    client_id: input.client_id,
    client_name: input.client_name,
    title: input.title,
    location: input.location,
    salary_range: input.salary_range,
    min_years: input.min_years,
    description: input.description,
    requirements: input.requirements,
    status: input.status,
    visa: input.visa,
    visa_notes: input.visa_notes,
    jd_text: input.jd_text,
    skills: input.skills,
    opened_at: ts,
    created_at: ts,
    updated_at: ts,
    archived_at: null,
    applicant_count: 0,
    stage_counts: stageCounts,
  };
  s.jobs.unshift(job);
  return clone(job);
}

/* ------------------------------------------------------------------ */
/* Hiring-manager notes                                                 */
/* ------------------------------------------------------------------ */

/** Notes for a job (works for both seeded and locally created jobs), newest first. */
export async function getJobNotes(jobId: string): Promise<JobNote[]> {
  return clone(store().notesByJob[jobId] ?? []);
}

export async function addLocalJobNote(
  jobId: string,
  body: string,
  authorName: string,
): Promise<JobNote> {
  const s = store();
  s.seq += 1;
  const note: JobNote = {
    id: `local-jn${s.seq}`,
    job_id: jobId,
    author_name: authorName,
    body,
    created_at: nowIso(),
  };
  (s.notesByJob[jobId] ??= []).unshift(note);
  return clone(note);
}
