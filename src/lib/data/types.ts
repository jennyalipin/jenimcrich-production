/**
 * Entity types, enums and display constants for the JeniMcRich ATS data layer.
 *
 * This module is CLIENT-SAFE: it contains no seed data and performs no I/O,
 * so client components may import labels/enums from "@/lib/data/types".
 * Data ACCESS goes through "@/lib/data" (server-side only — see index.ts).
 *
 * Field names are snake_case to mirror the Postgres schema in
 * docs/ARCHITECTURE.md so the swap to Supabase is mechanical.
 */

/* ----------------------------- enums ----------------------------- */

/** Fixed pipeline order (domain rule 1). `rejected` sits outside the funnel. */
export const STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;
export type Stage = (typeof STAGES)[number];

/** Funnel stages in order (excludes rejected). */
export const PIPELINE_STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
] as const satisfies readonly Stage[];

/** Stages a candidate can stall in (excludes hired/rejected — domain rule 3). */
export const ACTIVE_STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
] as const satisfies readonly Stage[];

export const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const JOB_STATUSES = ["open", "on_hold", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  on_hold: "On Hold",
  closed: "Closed",
};

/** Visa / work-authorization enum — first-class field on jobs (domain rule 4). */
export const VISA_TYPES = [
  "TN_CANADIAN_ONLY",
  "TN_CANADIAN_OR_MEXICAN",
  "US_CITIZEN_GC_ONLY",
  "H1B_TRANSFER",
  "SPONSORSHIP_AVAILABLE",
  "LOCAL",
  "UNSPECIFIED",
] as const;
export type VisaType = (typeof VISA_TYPES)[number];

export const VISA_LABELS: Record<VisaType, string> = {
  TN_CANADIAN_ONLY: "TN Visa – Canadians only",
  TN_CANADIAN_OR_MEXICAN: "TN Visa – Canadian or Mexican",
  US_CITIZEN_GC_ONLY: "US Citizens / Green Card only",
  H1B_TRANSFER: "H-1B transfer accepted",
  SPONSORSHIP_AVAILABLE: "Sponsorship available",
  LOCAL: "Local role (no visa requirement)",
  UNSPECIFIED: "Not specified",
};

const RESTRICTIVE_VISAS: ReadonlySet<VisaType> = new Set([
  "TN_CANADIAN_ONLY",
  "TN_CANADIAN_OR_MEXICAN",
  "US_CITIZEN_GC_ONLY",
  "H1B_TRANSFER",
]);

/** True when the 🛂 badge must be rendered (domain rule 4). */
export function isRestrictiveVisa(visa: VisaType): boolean {
  return RESTRICTIVE_VISAS.has(visa);
}

export const SOURCES = [
  "LinkedIn",
  "Referral",
  "Job Portal",
  "Indeed",
  "Agency",
] as const;
export type Source = (typeof SOURCES)[number];

export const NOTE_CATEGORIES = [
  "general",
  "screening",
  "interview_feedback",
  "client_feedback",
  "technical",
  "compensation",
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: "General",
  screening: "Screening",
  interview_feedback: "Interview Feedback",
  client_feedback: "Client Feedback",
  technical: "Technical",
  compensation: "Compensation",
};

export const RECOMMENDATIONS = [
  "strong_hire",
  "hire",
  "consider",
  "no_hire",
] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];
export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_hire: "Strong Hire",
  hire: "Hire",
  consider: "Consider",
  no_hire: "No Hire",
};

/** Scorecard competencies + weights (from the prototype's SC_CATS). */
export const SCORECARD_COMPETENCIES = [
  { key: "Technical Skills", weight: 3 },
  { key: "Industry Experience", weight: 3 },
  { key: "Communication", weight: 2 },
  { key: "Leadership", weight: 2 },
  { key: "Culture Fit", weight: 1 },
  { key: "Problem-Solving", weight: 2 },
] as const;

export const INTERVIEW_TYPES = [
  "hr_interview",
  "technical",
  "final_panel",
  "client_interview",
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  hr_interview: "HR Interview",
  technical: "Technical",
  final_panel: "Final Panel",
  client_interview: "Client Interview",
};

export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const DOCUMENT_CATEGORIES = [
  "resume",
  "portfolio",
  "certification",
  "offer_letter",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  resume: "Resume",
  portfolio: "Portfolio",
  certification: "Certification",
  offer_letter: "Offer Letter",
  other: "Other",
};

export const TEMPLATE_CATEGORIES = [
  "interview",
  "rejection",
  "offer",
  "update",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  interview: "Interview",
  rejection: "Rejection",
  offer: "Offer",
  update: "Update",
};

export const EMAIL_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "opened",
  "bounced",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const ACTIVITY_TYPES = [
  "stage",
  "note",
  "email",
  "doc",
  "interview",
  "tag",
  "flag",
  "scorecard",
  "system",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Allowed values for the stalled-candidate threshold (domain rule 3). */
export const STALLED_DAY_OPTIONS = [3, 5, 7, 10] as const;
export type StalledDays = (typeof STALLED_DAY_OPTIONS)[number];

/**
 * Fixed reference instant all demo timestamps are built around.
 * Lives here (as a plain string) so client components can compute
 * deterministic relative times without importing the server data module.
 */
export const REFERENCE_NOW_ISO = "2026-06-11T08:00:00.000Z";

/* ----------------------------- entities ----------------------------- */

interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Client extends BaseRow {
  name: string;
  contact_name: string;
  contact_email: string;
  notes: string | null;
}

export interface JobSkill {
  skill: string;
  /** Importance weight on the JD, 1–3 (domain rule 2). */
  weight: 1 | 2 | 3;
}

export interface Job extends BaseRow {
  client_id: string;
  /** Denormalized for list rendering; source of truth is `clients`. */
  client_name: string;
  title: string;
  location: string;
  /** Free text — agency works across currencies (see CLAUDE.md). */
  salary_range: string;
  min_years: number;
  description: string;
  requirements: string[];
  status: JobStatus;
  visa: VisaType;
  visa_notes: string | null;
  /** Full job-description text (input for matchmaker / jd-parser). */
  jd_text: string;
  skills: JobSkill[];
  opened_at: string;
  archived_at: string | null;
}

export interface CandidateSkill {
  skill: string;
  years: number;
}

export interface Candidate extends BaseRow {
  full_name: string;
  /** Demo data uses clearly-fake @example.com addresses. Never log PII. */
  email: string;
  phone: string;
  location: string;
  source: Source;
  years_exp: number;
  summary: string;
  expected_salary: string;
  notice_period: string;
  resume_text: string;
  flagged: boolean;
  skills: CandidateSkill[];
  certifications: string[];
  tags: string[];
  archived_at: string | null;
}

export interface Application extends BaseRow {
  candidate_id: string;
  job_id: string;
  stage: Stage;
  stage_entered_at: string;
  applied_at: string;
}

export interface Note extends BaseRow {
  candidate_id: string;
  author_name: string;
  category: NoteCategory;
  body: string;
}

export interface Scorecard extends BaseRow {
  application_id: string;
  candidate_id: string;
  interviewer_id: string;
  interviewer_name: string;
  /** Keyed by SCORECARD_COMPETENCIES key, ratings 1–5. */
  ratings: Record<string, number>;
  summary: string;
  recommendation: Recommendation;
}

export interface Interview extends BaseRow {
  application_id: string;
  candidate_id: string;
  interviewer_id: string;
  interviewer_name: string;
  /** UTC instant. UNIQUE(interviewer_id, starts_at) while scheduled. */
  starts_at: string;
  duration_minutes: number;
  interview_type: InterviewType;
  status: InterviewStatus;
}

export interface Interviewer {
  id: string;
  name: string;
  role: string;
}

export interface DocumentRecord extends BaseRow {
  candidate_id: string;
  file_name: string;
  category: DocumentCategory;
  uploaded_by: string;
}

export interface EmailTemplate extends BaseRow {
  name: string;
  category: TemplateCategory;
  /** May contain {{merge_fields}} — rendering belongs to lib/merge.ts. */
  subject: string;
  body: string;
}

export interface EmailLogEntry extends BaseRow {
  candidate_id: string;
  template_id: string | null;
  to_email: string;
  subject: string;
  status: EmailStatus;
  sent_at: string;
}

export interface ActivityLogEntry extends BaseRow {
  candidate_id: string;
  actor_name: string;
  type: ActivityType;
  body: string;
}

export interface Settings {
  stalled_days: StalledDays;
  stalled_enabled: boolean;
}

/* ----------------------------- composed shapes ----------------------------- */

export interface ApplicationWithJob extends Application {
  job: Job;
  /** Whole days in current stage relative to REFERENCE_NOW (clamped ≥ 0). */
  days_in_stage: number;
  is_stalled: boolean;
}

export interface ApplicationWithRelations extends ApplicationWithJob {
  candidate: Candidate;
}

export interface StalledApplication extends ApplicationWithRelations {
  /** Days since last stage move / note / email (domain rule 3). */
  days_stalled: number;
}

export interface CandidateWithApplications extends Candidate {
  applications: ApplicationWithJob[];
}

/** Everything the candidate detail page needs in one call. */
export interface CandidateProfile extends CandidateWithApplications {
  notes: Note[];
  scorecards: Scorecard[];
  interviews: Interview[];
  documents: DocumentRecord[];
  emails: EmailLogEntry[];
  activity: ActivityLogEntry[];
}

export interface InterviewWithRelations extends Interview {
  candidate: Candidate;
  job: Job;
  application: Application;
}

export interface JobWithStats extends Job {
  applicant_count: number;
  stage_counts: Record<Stage, number>;
}

export interface ActivityFeedItem extends ActivityLogEntry {
  candidate_name: string;
}

export interface FunnelStep {
  stage: Stage;
  label: string;
  /** Applications that reached this stage or further (rejected counts toward Applied only). */
  count: number;
  /** Conversion from the previous funnel step, 0–100. First step is 100. */
  conversion_pct: number;
}

export interface SourceStat {
  source: Source;
  total: number;
  /** Candidates from this source who reached Interview or further. */
  qualified: number;
}

export interface StageTime {
  stage: Stage;
  label: string;
  /** Average days current applications have been sitting in this stage. */
  avg_days: number;
}

export interface DashboardStats {
  stage_counts: Record<Stage, number>;
  active_candidates: number;
  flagged_candidates: number;
  open_jobs: number;
  /** Distinct clients with at least one open job. */
  open_clients: number;
  hired_total: number;
  avg_time_to_hire_days: number;
  stalled_count: number;
  stalled: StalledApplication[];
  todays_interviews: InterviewWithRelations[];
  upcoming_interviews: InterviewWithRelations[];
  recent_activity: ActivityFeedItem[];
}

export interface AnalyticsData {
  total_candidates: number;
  funnel: FunnelStep[];
  avg_time_to_hire_days: number;
  offers_extended: number;
  offers_accepted: number;
  /** 0–100; offers accepted (hired) over offers extended. */
  offer_acceptance_pct: number;
  /** 0–100; applications reaching Offer over applications reaching Interview. */
  interview_to_offer_pct: number;
  time_in_stage: StageTime[];
  source_breakdown: SourceStat[];
  activity_counts: {
    emails_sent: number;
    notes_logged: number;
    scorecards_submitted: number;
    interviews_scheduled: number;
    stalled_now: number;
  };
}

/* ----------------------------- filters & inputs ----------------------------- */

export interface JobFilters {
  status?: JobStatus;
  client_id?: string;
  visa?: VisaType;
  /** Matches title, client name, location and skills (case-insensitive). */
  q?: string;
}

export interface CandidateFilters {
  /** Matches name, email, summary, resume text, skills, certifications, tags. */
  q?: string;
  stages?: Stage[];
  job_ids?: string[];
  tags?: string[];
  sources?: Source[];
  flagged_only?: boolean;
  include_archived?: boolean;
}

export interface InterviewRange {
  /** Inclusive ISO lower bound on starts_at. */
  from?: string;
  /** Exclusive ISO upper bound on starts_at. */
  to?: string;
  interviewer_id?: string;
  status?: InterviewStatus;
}

export interface AddNoteInput {
  candidate_id: string;
  category: NoteCategory;
  body: string;
  author_name?: string;
}

export interface AddScorecardInput {
  application_id: string;
  interviewer_id: string;
  ratings: Record<string, number>;
  summary: string;
  recommendation: Recommendation;
}

export interface ScheduleInterviewInput {
  application_id: string;
  interviewer_id: string;
  /** UTC ISO instant. */
  starts_at: string;
  interview_type: InterviewType;
  duration_minutes?: number;
}

export interface LogEmailInput {
  candidate_id: string;
  template_id?: string | null;
  /** Defaults to the candidate's email. */
  to_email?: string;
  subject: string;
  status?: EmailStatus;
  actor_name?: string;
}

/* ----------------------------- errors ----------------------------- */

export type DataLayerErrorCode = "NOT_FOUND" | "SLOT_TAKEN" | "VALIDATION";

/**
 * Thrown by data-layer mutations. `message` is human-readable and safe to
 * surface to the (non-technical) user.
 */
export class DataLayerError extends Error {
  readonly code: DataLayerErrorCode;

  constructor(code: DataLayerErrorCode, message: string) {
    super(message);
    this.name = "DataLayerError";
    this.code = code;
  }
}
