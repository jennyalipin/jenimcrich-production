/**
 * Client-safe view-model types shared between the /candidates Server
 * Components and their client islands. Imports ONLY from client-safe
 * modules — never from "@/lib/data" (server-only).
 */

import type {
  DocumentCategory,
  InterviewStatus,
  NoteCategory,
  Source,
  Stage,
} from "@/lib/data/types";

/** Uniform result shape returned by every server action in actions.ts. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/* ----------------------------- list page ----------------------------- */

export interface CandidateListRow {
  id: string;
  name: string;
  email: string;
  flagged: boolean;
  years: number;
  topSkills: string[];
  /** Skills beyond the first three (rendered as "+N"). */
  moreSkills: number;
  /** Best-matching applied job (highest match score), if any application. */
  roleTitle: string | null;
  roleClient: string | null;
  /** True when the best-matching job has a restrictive visa requirement. */
  restrictiveVisa: boolean;
  /** Match score vs the best-matching applied job; null without applications. */
  score: number | null;
  stages: Stage[];
  tags: string[];
  source: Source;
  daysInStage: number | null;
  stalled: boolean;
}

export interface CandidateFilterState {
  q: string;
  stages: Stage[];
  tags: string[];
  flagged: boolean;
}

export interface JobOption {
  id: string;
  title: string;
  clientName: string;
}

/* ----------------------------- detail page ----------------------------- */

export interface HeaderApplication {
  applicationId: string;
  jobTitle: string;
  clientName: string;
  stage: Stage;
  daysInStage: number;
  isStalled: boolean;
  score: number;
  restrictiveVisa: boolean;
  visaLabel: string | null;
}

export interface CandidateHeaderData {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  source: Source;
  yearsExp: number;
  flagged: boolean;
  archived: boolean;
  tags: string[];
  expectedSalary: string;
  noticePeriod: string;
  /** Weighted scorecard average across all interviews, e.g. "4.2". */
  interviewAvg: string | null;
  /** Most recent application (the prototype's "their job"). */
  primary: HeaderApplication | null;
  /** Applications beyond the primary one. */
  extraApplications: number;
}

export interface NoteView {
  id: string;
  category: NoteCategory;
  categoryLabel: string;
  author: string;
  body: string;
  when: string;
}

export interface DocumentView {
  id: string;
  fileName: string;
  category: DocumentCategory;
  categoryLabel: string;
  uploadedBy: string;
  when: string;
}

export interface InterviewView {
  id: string;
  typeLabel: string;
  when: string;
  interviewer: string;
  status: InterviewStatus;
  durationMinutes: number;
}

/** Scheduled-interview instants used to block double-booked slots. */
export interface BookedSlot {
  interviewerId: string;
  startsAtMs: number;
}

export interface InterviewerOption {
  id: string;
  name: string;
}

export interface ApplicationOption {
  id: string;
  label: string;
}

export interface ActivityView {
  id: string;
  type: string;
  body: string;
  actor: string;
  when: string;
}
