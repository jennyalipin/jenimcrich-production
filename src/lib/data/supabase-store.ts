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
  Candidate,
  CandidateSkill,
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
  const clients: Client[] = unwrap("clients", clientsRes).map((c) => ({
    id: c.id,
    name: c.name,
    contact_name: str(c.contact_name),
    contact_email: str(c.contact_email),
    notes: c.notes,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  // ---- Jobs (+ skills) ----
  const jobSkills = unwrap("job skills", jobSkillsRes);
  const skillsByJob = new Map<string, JobSkill[]>();
  for (const js of jobSkills) {
    const list = skillsByJob.get(js.job_id) ?? [];
    list.push({ skill: js.skill, weight: weight1to3(js.weight) });
    skillsByJob.set(js.job_id, list);
  }
  const jobs: Job[] = unwrap("jobs", jobsRes).map((j) => ({
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
  }));

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
