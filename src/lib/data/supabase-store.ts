/**
 * Supabase → demo-store hydration — ⚠️ SERVER-ONLY.
 *
 * Loads every table the data layer needs and assembles a snapshot in the
 * exact `DemoStore` shape `index.ts` already derives all reads from. This is
 * the seam the README describes: pages and the composition/analytics helpers
 * never change — only the data source does.
 *
 * Why hydrate the whole store instead of bespoke per-call SQL? The reads in
 * index.ts (funnel, stalled math, joins) are pure functions over the store
 * and already unit-tested. Reusing them against a live snapshot keeps that
 * tested behaviour identical; only the row→domain mapping lives here.
 *
 * The query client is RLS-scoped (the signed-in user), so SELECTs return
 * exactly what that user may see — domain rule 7 is enforced by Postgres,
 * not by this code.
 *
 * Mapping notes (DB schema ≠ domain 1:1):
 *   - names are denormalised from `profiles` (notes.author, activity.actor,
 *     interview/scorecard interviewer);
 *   - skills / certifications / tags live in child tables;
 *   - interviews & scorecards derive candidate_id through their application;
 *   - nullable DB columns the domain treats as required are coalesced to "".
 */

import { DataLayerError } from "./types";
import type { DemoStore } from "./demo-data";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  ActivityLogEntry,
  ActivityType,
  Application,
  ApplicationWithJob,
  Candidate,
  CandidateSkill,
  CandidateWithApplications,
  Client,
  DocumentRecord,
  EmailLogEntry,
  EmailStatus,
  EmailTemplate,
  Interview,
  InterviewType,
  Interviewer,
  Job,
  JobSkill,
  Note,
  NoteCategory,
  Recommendation,
  Scorecard,
  Settings,
  Source,
  Stage,
  StalledDays,
  TemplateCategory,
  VisaType,
} from "./types";
import { ACTIVE_STAGES } from "./types";

const STALLED_VALUES: readonly StalledDays[] = [3, 5, 7, 10];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
};

const str = (v: string | null | undefined): string => v ?? "";
const weight1to3 = (n: number): 1 | 2 | 3 => (n <= 1 ? 1 : n >= 3 ? 3 : 2);

// The DB enums carry a couple of values (and a different casing for sources)
// the narrower domain unions don't model. Map them to the closest domain
// member so reads stay strongly typed instead of casting blindly.
const SOURCE_MAP: Record<string, Source> = {
  linkedin: "LinkedIn",
  referral: "Referral",
  job_portal: "Job Portal",
  indeed: "Indeed",
  agency: "Agency",
  other: "Agency",
};
const toSource = (s: string): Source => SOURCE_MAP[s] ?? "Agency";

const INTERVIEW_TYPE_MAP: Record<string, InterviewType> = {
  hr_interview: "hr_interview",
  technical: "technical",
  final_panel: "final_panel",
  client_interview: "client_interview",
  phone_screen: "hr_interview",
  panel: "final_panel",
  other: "hr_interview",
};
const toInterviewType = (t: string): InterviewType => INTERVIEW_TYPE_MAP[t] ?? "hr_interview";

const TEMPLATE_CATEGORY_MAP: Record<string, TemplateCategory> = {
  interview: "interview",
  rejection: "rejection",
  offer: "offer",
  update: "update",
  outreach: "update",
  other: "update",
};
const toTemplateCategory = (c: string): TemplateCategory => TEMPLATE_CATEGORY_MAP[c] ?? "update";

/** Fail loudly but with a human-readable message if any query errors. */
function unwrap<T>(label: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) {
    throw new DataLayerError(
      "VALIDATION",
      `Could not load ${label} from the database. ${res.error.message}`,
    );
  }
  return (res.data ?? []) as T;
}

/* ---- Row → domain mappers (shared by loadStore and the bounded views) ---- */

type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapClientRow(c: ClientRow): Client {
  return {
    id: c.id,
    name: c.name,
    contact_name: str(c.contact_name),
    contact_email: str(c.contact_email),
    notes: c.notes,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

function groupJobSkills(rows: { job_id: string; skill: string; weight: number }[]): Map<string, JobSkill[]> {
  const byJob = new Map<string, JobSkill[]>();
  for (const js of rows) {
    const list = byJob.get(js.job_id) ?? [];
    list.push({ skill: js.skill, weight: weight1to3(js.weight) });
    byJob.set(js.job_id, list);
  }
  return byJob;
}

type JobRow = {
  id: string;
  client_id: string;
  title: string;
  location: string | null;
  salary_range: string | null;
  min_years: number;
  description: string | null;
  requirements: string[] | null;
  status: Job["status"];
  visa: string;
  visa_notes: string | null;
  jd_text: string | null;
  opened_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapJobRow(
  j: JobRow,
  clientNameById: Map<string, string>,
  skillsByJob: Map<string, JobSkill[]>,
): Job {
  return {
    id: j.id,
    client_id: j.client_id,
    client_name: clientNameById.get(j.client_id) ?? "",
    title: j.title,
    location: str(j.location),
    salary_range: str(j.salary_range),
    min_years: j.min_years,
    description: str(j.description),
    requirements: j.requirements ?? [],
    status: j.status,
    visa: j.visa as VisaType,
    visa_notes: j.visa_notes,
    jd_text: str(j.jd_text),
    skills: skillsByJob.get(j.id) ?? [],
    opened_at: j.opened_at,
    archived_at: j.archived_at,
    created_at: j.created_at,
    updated_at: j.updated_at,
  };
}

/**
 * Read every table (RLS-scoped) and assemble a `DemoStore` snapshot. Called
 * once per request by the data layer when Supabase is configured — never
 * cached, so each request reflects committed state.
 */
export async function loadStore(supabase: SupabaseServerClient): Promise<DemoStore> {
  const [
    profilesRes,
    clientsRes,
    jobsRes,
    jobSkillsRes,
    candidatesRes,
    candSkillsRes,
    candCertsRes,
    candTagsRes,
    applicationsRes,
    notesRes,
    scorecardsRes,
    interviewsRes,
    documentsRes,
    templatesRes,
    emailLogRes,
    activityRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, archived_at"),
    supabase.from("clients").select("*"),
    supabase.from("jobs").select("*"),
    supabase.from("job_skills").select("job_id, skill, weight"),
    supabase.from("candidates").select("*"),
    supabase.from("candidate_skills").select("candidate_id, skill, years"),
    supabase.from("candidate_certifications").select("candidate_id, name"),
    supabase.from("candidate_tags").select("candidate_id, tag"),
    supabase.from("applications").select("*"),
    supabase.from("notes").select("*").is("archived_at", null),
    supabase.from("scorecards").select("*").is("archived_at", null),
    supabase.from("interviews").select("*").is("archived_at", null),
    supabase.from("documents").select("*").is("archived_at", null),
    supabase.from("email_templates").select("*").is("archived_at", null),
    supabase.from("email_log").select("*"),
    supabase.from("activity_log").select("*"),
    supabase.from("settings").select("*").limit(1),
  ]);

  const profiles = unwrap("staff profiles", profilesRes);
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));

  // ---- Interviewers (staff) ----
  const interviewers: Interviewer[] = profiles
    .filter((p) => p.archived_at === null)
    .map((p) => ({ id: p.id, name: p.full_name, role: ROLE_LABELS[p.role] ?? p.role }));

  // ---- Clients ----
  const clients: Client[] = unwrap("clients", clientsRes).map(mapClientRow);
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  // ---- Jobs (+ skills) ----
  const skillsByJob = groupJobSkills(unwrap("job skills", jobSkillsRes));
  const jobs: Job[] = unwrap("jobs", jobsRes).map((j) => mapJobRow(j, clientNameById, skillsByJob));

  // ---- Candidates (+ skills / certs / tags) ----
  const candSkills = unwrap("candidate skills", candSkillsRes);
  const candCerts = unwrap("candidate certifications", candCertsRes);
  const candTags = unwrap("candidate tags", candTagsRes);
  const skillsByCand = new Map<string, CandidateSkill[]>();
  for (const cs of candSkills) {
    const list = skillsByCand.get(cs.candidate_id) ?? [];
    list.push({ skill: cs.skill, years: cs.years });
    skillsByCand.set(cs.candidate_id, list);
  }
  const certsByCand = new Map<string, string[]>();
  for (const cc of candCerts) {
    const list = certsByCand.get(cc.candidate_id) ?? [];
    list.push(cc.name);
    certsByCand.set(cc.candidate_id, list);
  }
  const tagsByCand = new Map<string, string[]>();
  for (const ct of candTags) {
    const list = tagsByCand.get(ct.candidate_id) ?? [];
    list.push(ct.tag);
    tagsByCand.set(ct.candidate_id, list);
  }
  const candidates: Candidate[] = unwrap("candidates", candidatesRes).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    email: str(c.email),
    phone: str(c.phone),
    location: str(c.location),
    source: toSource(c.source),
    years_exp: c.years_exp,
    summary: str(c.summary),
    expected_salary: str(c.expected_salary),
    notice_period: str(c.notice_period),
    resume_text: str(c.resume_text),
    flagged: c.flagged,
    skills: skillsByCand.get(c.id) ?? [],
    certifications: certsByCand.get(c.id) ?? [],
    tags: tagsByCand.get(c.id) ?? [],
    archived_at: c.archived_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  // ---- Applications ----
  const applications: Application[] = unwrap("applications", applicationsRes).map((a) => ({
    id: a.id,
    candidate_id: a.candidate_id,
    job_id: a.job_id,
    stage: a.stage as Stage,
    stage_entered_at: a.stage_entered_at,
    applied_at: a.applied_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }));
  const candidateByApp = new Map(applications.map((a) => [a.id, a.candidate_id]));

  // ---- Notes ----
  const notes: Note[] = unwrap("notes", notesRes).map((n) => ({
    id: n.id,
    candidate_id: n.candidate_id,
    author_name: (n.author_id && nameById.get(n.author_id)) || "Jenny M.",
    category: n.category as NoteCategory,
    body: n.body,
    created_at: n.created_at,
    updated_at: n.updated_at,
  }));

  // ---- Scorecards ----
  const scorecards: Scorecard[] = unwrap("scorecards", scorecardsRes).map((sc) => ({
    id: sc.id,
    application_id: sc.application_id,
    candidate_id: candidateByApp.get(sc.application_id) ?? "",
    interviewer_id: str(sc.interviewer_id),
    interviewer_name: (sc.interviewer_id && nameById.get(sc.interviewer_id)) || "Interviewer",
    ratings: (sc.ratings as Record<string, number>) ?? {},
    summary: sc.summary,
    recommendation: sc.recommendation as Recommendation,
    created_at: sc.created_at,
    updated_at: sc.updated_at,
  }));

  // ---- Interviews ----
  const interviews: Interview[] = unwrap("interviews", interviewsRes).map((iv) => ({
    id: iv.id,
    application_id: iv.application_id,
    candidate_id: candidateByApp.get(iv.application_id) ?? "",
    interviewer_id: iv.interviewer_id,
    interviewer_name: nameById.get(iv.interviewer_id) ?? "Interviewer",
    starts_at: iv.starts_at,
    duration_minutes: iv.duration_minutes,
    interview_type: toInterviewType(iv.type),
    status: iv.status,
    created_at: iv.created_at,
    updated_at: iv.updated_at,
  }));

  // ---- Documents ----
  const documents: DocumentRecord[] = unwrap("documents", documentsRes).map((d) => ({
    id: d.id,
    candidate_id: d.candidate_id,
    file_name: d.file_name,
    category: d.category,
    uploaded_by: (d.uploaded_by && nameById.get(d.uploaded_by)) || "Jenny M.",
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));

  // ---- Email templates ----
  const templates: EmailTemplate[] = unwrap("email templates", templatesRes).map((t) => ({
    id: t.id,
    name: t.name,
    category: toTemplateCategory(t.category),
    subject: t.subject,
    body: t.body,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  // ---- Email log ----
  const email_log: EmailLogEntry[] = unwrap("email log", emailLogRes).map((e) => ({
    id: e.id,
    candidate_id: e.candidate_id,
    template_id: e.template_id,
    to_email: e.to_email,
    subject: e.subject,
    status: e.status as EmailStatus,
    sent_at: e.created_at,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));

  // ---- Activity log ----
  const activity_log: ActivityLogEntry[] = unwrap("activity log", activityRes).map((a) => ({
    id: a.id,
    candidate_id: a.candidate_id,
    actor_name: (a.actor_id && nameById.get(a.actor_id)) || "System",
    type: a.type as ActivityType,
    body: a.body,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }));

  // ---- Settings (singleton) ----
  const settingsRow = unwrap("settings", settingsRes)[0];
  const stalledDays = (settingsRow?.stalled_days ?? 5) as number;
  const settings: Settings = {
    stalled_days: (STALLED_VALUES.includes(stalledDays as StalledDays)
      ? stalledDays
      : 5) as StalledDays,
    stalled_enabled: settingsRow?.stalled_enabled ?? true,
  };

  return {
    clients,
    interviewers,
    jobs,
    candidates,
    applications,
    notes,
    scorecards,
    interviews,
    documents,
    templates,
    email_log,
    activity_log,
    settings,
    seq: 0,
  };
}

const PAGE_DAY_MS = 86_400_000;

/**
 * Scalable candidate-page loader: fetches ONLY the given candidate ids (one
 * page) plus their related rows, and returns fully-formed
 * CandidateWithApplications in `ids` order. Unlike loadStore() this never
 * hydrates the whole table, so it stays cheap at 15k+ candidates. Computes
 * days_in_stage / is_stalled with the same formulas as the in-memory layer
 * (domain rule 3), using the real clock (live Supabase path).
 */
export async function loadCandidatesPageData(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<CandidateWithApplications[]> {
  if (ids.length === 0) return [];

  const [candR, skR, certR, tagR, appR, noteR, emailR, setR] = await Promise.all([
    supabase.from("candidates").select("*").in("id", ids),
    supabase.from("candidate_skills").select("candidate_id, skill, years").in("candidate_id", ids),
    supabase.from("candidate_certifications").select("candidate_id, name").in("candidate_id", ids),
    supabase.from("candidate_tags").select("candidate_id, tag").in("candidate_id", ids),
    supabase.from("applications").select("*").in("candidate_id", ids),
    supabase.from("notes").select("candidate_id, created_at").in("candidate_id", ids).is("archived_at", null),
    supabase.from("email_log").select("candidate_id, created_at").in("candidate_id", ids),
    supabase.from("settings").select("stalled_days, stalled_enabled").limit(1).maybeSingle(),
  ]);

  // Empty `.in([])` is invalid in PostgREST; use a never-matching sentinel id so
  // every query is typed identically whether or not the page has applications.
  const NO_ID = "00000000-0000-0000-0000-000000000000";
  const appRows = appR.data ?? [];
  const jobIds = [...new Set(appRows.map((a) => a.job_id))];
  const [jobR, jobSkillR] = await Promise.all([
    supabase.from("jobs").select("*").in("id", jobIds.length ? jobIds : [NO_ID]),
    supabase.from("job_skills").select("job_id, skill, weight").in("job_id", jobIds.length ? jobIds : [NO_ID]),
  ]);
  const jobRows = jobR.data ?? [];
  const clientIds = [...new Set(jobRows.map((j) => j.client_id))];
  const cliR = await supabase
    .from("clients")
    .select("id, name")
    .in("id", clientIds.length ? clientIds : [NO_ID]);
  const clientName = new Map((cliR.data ?? []).map((c) => [c.id, c.name]));

  // ---- group child rows by parent id ----
  const skillsByCand = new Map<string, CandidateSkill[]>();
  for (const r of skR.data ?? []) {
    const list = skillsByCand.get(r.candidate_id) ?? [];
    list.push({ skill: r.skill, years: r.years });
    skillsByCand.set(r.candidate_id, list);
  }
  const certsByCand = new Map<string, string[]>();
  for (const r of certR.data ?? []) {
    const list = certsByCand.get(r.candidate_id) ?? [];
    list.push(r.name);
    certsByCand.set(r.candidate_id, list);
  }
  const tagsByCand = new Map<string, string[]>();
  for (const r of tagR.data ?? []) {
    const list = tagsByCand.get(r.candidate_id) ?? [];
    list.push(r.tag);
    tagsByCand.set(r.candidate_id, list);
  }
  const skillsByJob = new Map<string, JobSkill[]>();
  for (const r of jobSkillR.data ?? []) {
    const list = skillsByJob.get(r.job_id) ?? [];
    list.push({ skill: r.skill, weight: weight1to3(r.weight) });
    skillsByJob.set(r.job_id, list);
  }

  const jobById = new Map<string, Job>();
  for (const j of jobRows) {
    jobById.set(j.id, {
      id: j.id,
      client_id: j.client_id,
      client_name: clientName.get(j.client_id) ?? "",
      title: j.title,
      location: str(j.location),
      salary_range: str(j.salary_range),
      min_years: j.min_years,
      description: str(j.description),
      requirements: j.requirements ?? [],
      status: j.status,
      visa: j.visa as VisaType,
      visa_notes: j.visa_notes,
      jd_text: str(j.jd_text),
      skills: skillsByJob.get(j.id) ?? [],
      opened_at: j.opened_at,
      archived_at: j.archived_at,
      created_at: j.created_at,
      updated_at: j.updated_at,
    });
  }

  // ---- stalled inputs (last note / email per candidate) ----
  const lastNote = new Map<string, number>();
  for (const n of noteR.data ?? []) {
    lastNote.set(n.candidate_id, Math.max(lastNote.get(n.candidate_id) ?? 0, Date.parse(n.created_at)));
  }
  const lastEmail = new Map<string, number>();
  for (const e of emailR.data ?? []) {
    lastEmail.set(e.candidate_id, Math.max(lastEmail.get(e.candidate_id) ?? 0, Date.parse(e.created_at)));
  }
  const stalledDays = setR.data?.stalled_days ?? 5;
  const stalledEnabled = setR.data?.stalled_enabled ?? true;
  const now = Date.now();

  const candById = new Map(
    (candR.data ?? []).map((c) => [
      c.id,
      {
        id: c.id,
        full_name: c.full_name,
        email: str(c.email),
        phone: str(c.phone),
        location: str(c.location),
        source: toSource(c.source),
        years_exp: c.years_exp,
        summary: str(c.summary),
        expected_salary: str(c.expected_salary),
        notice_period: str(c.notice_period),
        resume_text: str(c.resume_text),
        flagged: c.flagged,
        skills: skillsByCand.get(c.id) ?? [],
        certifications: certsByCand.get(c.id) ?? [],
        tags: tagsByCand.get(c.id) ?? [],
        archived_at: c.archived_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
      } satisfies Candidate,
    ]),
  );

  const appsByCand = new Map<string, typeof appRows>();
  for (const a of appRows) {
    const list = appsByCand.get(a.candidate_id) ?? [];
    list.push(a);
    appsByCand.set(a.candidate_id, list);
  }

  return ids
    .map((id) => candById.get(id))
    .filter((c): c is Candidate => c !== undefined)
    .map((c) => {
      const apps = (appsByCand.get(c.id) ?? [])
        .slice()
        .sort((a, b) => (a.applied_at < b.applied_at ? 1 : -1))
        .map((a): ApplicationWithJob => {
          const enteredMs = Date.parse(a.stage_entered_at);
          const lastTouch = Math.max(enteredMs, lastNote.get(c.id) ?? 0, lastEmail.get(c.id) ?? 0);
          const daysStalled = Math.max(0, Math.floor((now - lastTouch) / PAGE_DAY_MS));
          const stage = a.stage as Stage;
          return {
            id: a.id,
            candidate_id: a.candidate_id,
            job_id: a.job_id,
            stage,
            stage_entered_at: a.stage_entered_at,
            applied_at: a.applied_at,
            created_at: a.created_at,
            updated_at: a.updated_at,
            job: jobById.get(a.job_id)!,
            days_in_stage: Math.max(0, Math.floor((now - enteredMs) / PAGE_DAY_MS)),
            is_stalled:
              stalledEnabled &&
              c.archived_at === null &&
              (ACTIVE_STAGES as readonly Stage[]).includes(stage) &&
              daysStalled >= stalledDays,
          };
        })
        .filter((a) => a.job !== undefined);
      return { ...c, applications: apps };
    });
}

/** Just the client directory (New-Job form, client matching) — one small table. */
export async function loadClients(supabase: SupabaseServerClient): Promise<Client[]> {
  return unwrap("clients", await supabase.from("clients").select("*")).map(mapClientRow);
}

/**
 * Bounded read backing the Jobs list + New-Job form. Loads only the tables
 * that page needs — jobs, their skills, client names, and the application
 * rows required for per-stage stats — instead of the full 17-table
 * `loadStore` hydration. Saving a job and re-rendering the list therefore
 * never drags the candidate, notes, interview or activity tables.
 */
export async function loadJobsView(supabase: SupabaseServerClient): Promise<{
  jobs: Job[];
  clients: Client[];
  applications: { job_id: string; candidate_id: string; stage: Stage }[];
  archivedCandidateIds: Set<string>;
}> {
  const [clientsRes, jobsRes, jobSkillsRes, appsRes, candsRes] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("jobs").select("*").is("archived_at", null),
    supabase.from("job_skills").select("job_id, skill, weight"),
    supabase.from("applications").select("job_id, candidate_id, stage"),
    supabase.from("candidates").select("id, archived_at"),
  ]);

  const clients = unwrap("clients", clientsRes).map(mapClientRow);
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
  const skillsByJob = groupJobSkills(unwrap("job skills", jobSkillsRes));
  const jobs = unwrap("jobs", jobsRes).map((j) => mapJobRow(j, clientNameById, skillsByJob));
  const applications = unwrap("applications", appsRes).map((a) => ({
    job_id: a.job_id,
    candidate_id: a.candidate_id,
    stage: a.stage as Stage,
  }));
  const archivedCandidateIds = new Set(
    unwrap("candidates", candsRes)
      .filter((c) => c.archived_at !== null)
      .map((c) => c.id),
  );

  return { jobs, clients, applications, archivedCandidateIds };
}
