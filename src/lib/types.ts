/**
 * Shared pure-domain types for the JeniMcRich Recruitment ATS.
 *
 * These types are UI- and DB-agnostic: no React, no Supabase, no Next.js.
 * They use the human-readable values the prototype uses (e.g. stage
 * "Interview", not the DB enum "interview"). The Supabase layer is
 * responsible for mapping to/from snake_case DB enums.
 */

/* ------------------------------------------------------------------ */
/* Pipeline stages (domain rule: fixed, do not change)                 */
/* ------------------------------------------------------------------ */

export const STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
] as const;

export type Stage = (typeof STAGES)[number];

/** Stages excluded from "stalled candidate" checks (domain rule 3). */
export const TERMINAL_STAGES = ["Hired", "Rejected"] as const satisfies readonly Stage[];

/** Stalled-candidate threshold options in days, and the default (domain rule 3). */
export const STALLED_DAY_OPTIONS = [3, 5, 7, 10] as const;
export const DEFAULT_STALLED_DAYS = 5;

/* ------------------------------------------------------------------ */
/* Visa / work authorization (first-class field on jobs)               */
/* ------------------------------------------------------------------ */

export const VISA_REQUIREMENTS = [
  "UNSPECIFIED",
  "US_CITIZEN_GC_ONLY",
  "TN_CANADIAN_ONLY",
  "TN_CANADIAN_OR_MEXICAN",
  "H1B_TRANSFER",
  "SPONSORSHIP_AVAILABLE",
  "LOCAL",
] as const;

export type VisaRequirement = (typeof VISA_REQUIREMENTS)[number];

/** Human-readable labels (exact wording from the prototype's VISA_OPTIONS). */
export const VISA_LABELS: Readonly<Record<VisaRequirement, string>> = {
  UNSPECIFIED: "Not specified",
  US_CITIZEN_GC_ONLY: "US Citizens / Green Card only",
  TN_CANADIAN_ONLY: "TN Visa – Canadians only",
  TN_CANADIAN_OR_MEXICAN: "TN Visa – Canadian or Mexican",
  H1B_TRANSFER: "H-1B transfer accepted",
  SPONSORSHIP_AVAILABLE: "Open to international / sponsorship available",
  LOCAL: "Local role (no visa requirement)",
};

/**
 * Visa requirements that restrict who can be placed — these must render
 * the 🛂 badge in the UI (CLAUDE.md domain rule 4).
 */
export const RESTRICTIVE_VISAS = [
  "TN_CANADIAN_ONLY",
  "TN_CANADIAN_OR_MEXICAN",
  "US_CITIZEN_GC_ONLY",
  "H1B_TRANSFER",
] as const satisfies readonly VisaRequirement[];

export function isRestrictiveVisa(visa: VisaRequirement): boolean {
  return (RESTRICTIVE_VISAS as readonly VisaRequirement[]).includes(visa);
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

/** JD skill weight: 1 (nice to have) … 3 (critical). DB check 1..3. */
export type SkillWeight = 1 | 2 | 3;

/** A skill required by a job, with its importance weight. */
export interface JobSkill {
  skill: string;
  weight: SkillWeight;
}

/** A skill a candidate has, with years of hands-on experience. */
export interface CandidateSkill {
  skill: string;
  years: number;
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export const JOB_STATUSES = ["Open", "On Hold", "Closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Job {
  id: string;
  title: string;
  /** Client company display name (the DB layer joins from the clients table). */
  client: string;
  location: string;
  /** Free-text range, e.g. "₱180k–240k/mo" — agency works across currencies. */
  salaryRange: string;
  minYears: number;
  status: JobStatus;
  visa: VisaRequirement;
  visaNotes: string;
  skills: JobSkill[];
  /** Requirement bullets shown on the job card. */
  requirements: string[];
  description: string;
  /** Raw pasted JD text, if any. */
  jdText: string;
  /** ISO 8601 UTC timestamp. */
  openedAt: string;
}

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

export const CANDIDATE_SOURCES = [
  "LinkedIn",
  "Referral",
  "Job Portal",
  "Indeed",
  "Agency",
] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: CandidateSource;
  yearsExp: number;
  skills: CandidateSkill[];
  certifications: string[];
  summary: string;
  /** Free-text, e.g. "₱135,000/mo". */
  expectedSalary: string;
  /** Free-text, e.g. "30 days". */
  noticePeriod: string;
  tags: string[];
  flagged: boolean;
  /** Extracted resume text, used for search. */
  resumeText: string;
  /** Soft delete — never hard-delete candidates. Null when active. */
  archivedAt: string | null;
}

/** A candidate's application to one job (a candidate can apply to several). */
export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  stage: Stage;
  /** ISO 8601 UTC — updated on every stage change (domain rule 1). */
  stageEnteredAt: string;
  appliedAt: string;
  /** Cached match score, recomputed by the app (optional). */
  matchScore?: number;
}

/* ------------------------------------------------------------------ */
/* Match scoring contracts (engine lives in scoring.ts)                */
/* ------------------------------------------------------------------ */

/**
 * Minimal candidate shape the scoring engine needs. `Candidate` satisfies
 * this structurally; so do ad-hoc resume-parse results in the Matchmaker.
 */
export interface ScoreCandidateInput {
  name: string;
  yearsExp: number;
  skills: readonly CandidateSkill[];
  certifications: readonly string[];
}

/** Minimal job shape the scoring engine needs. `Job` satisfies this. */
export interface ScoreJobInput {
  minYears: number;
  skills: readonly JobSkill[];
}

export interface MatchResult {
  /** Integer 0–100. */
  score: number;
  /** Human-readable strengths, e.g. "Kiln Management: 11 yrs experience". */
  pros: string[];
  /** Human-readable concerns, e.g. "Only 4 yrs total experience (10 required)". */
  cons: string[];
  /** JD skill names the candidate is missing entirely. */
  gaps: string[];
  /** One-line "The Edge" pitch, or "" when the candidate has no skills. */
  edge: string;
}

/** Score color band: green ≥80, amber 60–79, red <60 (domain rule 2). */
export type ScoreBand = "high" | "mid" | "low";

export const SCORE_THRESHOLDS = {
  /** Scores at or above this are "high" (green). */
  high: 80,
  /** Scores at or above this (and below high) are "mid" (amber). */
  mid: 60,
} as const;

/* ------------------------------------------------------------------ */
/* Interviews, scorecards, notes, activity, templates                  */
/* ------------------------------------------------------------------ */

export const INTERVIEW_STATUSES = ["Scheduled", "Completed", "Cancelled"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export interface Interview {
  id: string;
  applicationId: string;
  interviewer: string;
  /** ISO 8601 UTC start time. */
  startsAt: string;
  /** e.g. "Technical", "HR Interview", "Final Panel". */
  type: string;
  status: InterviewStatus;
}

/** Scorecard competency categories with their weights (from the prototype). */
export const SCORECARD_CATEGORIES = [
  { key: "Technical Skills", weight: 3 },
  { key: "Industry Experience", weight: 3 },
  { key: "Communication", weight: 2 },
  { key: "Leadership", weight: 2 },
  { key: "Culture Fit", weight: 1 },
  { key: "Problem-Solving", weight: 2 },
] as const;

export const SCORECARD_RECOMMENDATIONS = [
  "Strong Hire",
  "Hire",
  "Consider",
  "No Hire",
] as const;
export type ScorecardRecommendation = (typeof SCORECARD_RECOMMENDATIONS)[number];

export interface Scorecard {
  id: string;
  applicationId: string;
  interviewer: string;
  /** Competency → rating 1–5. */
  ratings: Record<string, number>;
  summary: string;
  recommendation: ScorecardRecommendation;
  createdAt: string;
}

export const NOTE_CATEGORIES = [
  "General",
  "Screening",
  "Interview Feedback",
  "Client Feedback",
  "Technical Assessment",
  "Compensation",
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export interface CandidateNote {
  id: string;
  candidateId: string;
  author: string;
  category: NoteCategory;
  body: string;
  createdAt: string;
}

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

/** Append-only audit-trail entry. */
export interface ActivityEvent {
  id: string;
  candidateId: string;
  type: ActivityType;
  text: string;
  /** Actor display name ("System" for automated entries). */
  by: string;
  /** ISO 8601 UTC. */
  at: string;
}

export const DOCUMENT_CATEGORIES = [
  "Resume",
  "Portfolio",
  "Certification",
  "Offer Letter",
  "Other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface CandidateDocument {
  id: string;
  candidateId: string;
  fileName: string;
  category: DocumentCategory;
  uploadedAt: string;
}

export const TEMPLATE_CATEGORIES = [
  "Interview",
  "Rejection",
  "Offer",
  "Update",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  /** May contain {{merge_fields}} — validate with merge.ts before saving. */
  subject: string;
  body: string;
}
