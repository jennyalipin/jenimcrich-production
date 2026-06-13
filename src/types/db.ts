/**
 * Hand-written database types mirroring supabase/migrations/0001_schema.sql.
 *
 * Replace with generated types once a Supabase project is provisioned:
 *   pnpm dlx supabase gen types typescript --linked > src/types/db.ts
 * The shape below follows the codegen output exactly (Database interface with
 * Tables / Row / Insert / Update / Relationships, Enums, Functions) so the
 * swap is a drop-in.
 *
 * Enum values match the Postgres enums 1:1 — note that `visa_requirement`
 * is intentionally UPPERCASE in the DB (CLAUDE.md domain rule #4 spelling)
 * while every other enum is lowercase snake_case.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ------------------------------------------------------------------ */
/* Enum value lists (single source for unions + Zod z.enum(...))       */
/* ------------------------------------------------------------------ */

export const USER_ROLES = ["admin", "recruiter", "hiring_manager"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const JOB_STATUSES = ["open", "on_hold", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** UPPERCASE on purpose — matches CLAUDE.md domain rule #4 and the DB enum. */
export const VISA_REQUIREMENTS = [
  "TN_CANADIAN_ONLY",
  "TN_CANADIAN_OR_MEXICAN",
  "US_CITIZEN_GC_ONLY",
  "H1B_TRANSFER",
  "SPONSORSHIP_AVAILABLE",
  "LOCAL",
  "UNSPECIFIED",
] as const;
export type VisaRequirement = (typeof VISA_REQUIREMENTS)[number];

export const CANDIDATE_SOURCES = [
  "linkedin",
  "referral",
  "job_portal",
  "indeed",
  "agency",
  "other",
] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/** Fixed pipeline (CLAUDE.md domain rule #1). */
export const PIPELINE_STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const NOTE_CATEGORIES = [
  "general",
  "screening",
  "interview_feedback",
  "client_feedback",
  "technical",
  "compensation",
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const SCORECARD_RECOMMENDATIONS = [
  "strong_hire",
  "hire",
  "consider",
  "no_hire",
] as const;
export type ScorecardRecommendation = (typeof SCORECARD_RECOMMENDATIONS)[number];

export const INTERVIEW_TYPES = [
  "phone_screen",
  "hr_interview",
  "technical",
  "panel",
  "final_panel",
  "client_interview",
  "other",
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

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

export const EMAIL_TEMPLATE_CATEGORIES = [
  "interview",
  "rejection",
  "offer",
  "update",
  "outreach",
  "other",
] as const;
export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

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

/* ------------------------------------------------------------------ */
/* Row / Insert shapes per table                                       */
/* (Update = Partial<Insert>, declared inline in Database below)       */
/* ------------------------------------------------------------------ */

export type ProfileRow = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type ProfileInsert = {
  id?: string;
  user_id?: string | null;
  email: string;
  full_name: string;
  role?: UserRole;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type ClientInsert = {
  id?: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type JobRow = {
  id: string;
  client_id: string;
  title: string;
  location: string | null;
  salary_range: string | null;
  min_years: number;
  description: string | null;
  status: JobStatus;
  visa: VisaRequirement;
  visa_notes: string | null;
  jd_text: string | null;
  opened_at: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type JobInsert = {
  id?: string;
  client_id: string;
  title: string;
  location?: string | null;
  salary_range?: string | null;
  min_years?: number;
  description?: string | null;
  status?: JobStatus;
  visa?: VisaRequirement;
  visa_notes?: string | null;
  jd_text?: string | null;
  opened_at?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type JobSkillRow = {
  id: string;
  job_id: string;
  skill: string;
  weight: number;
  created_at: string;
  updated_at: string;
}
export type JobSkillInsert = {
  id?: string;
  job_id: string;
  skill: string;
  weight?: number;
  created_at?: string;
  updated_at?: string;
}

export type JobNoteRow = {
  id: string;
  job_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type JobNoteInsert = {
  id?: string;
  job_id: string;
  author_id?: string | null;
  body: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type CandidateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  years_exp: number;
  summary: string | null;
  expected_salary: string | null;
  notice_period: string | null;
  resume_text: string | null;
  flagged: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type CandidateInsert = {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  source?: CandidateSource;
  years_exp?: number;
  summary?: string | null;
  expected_salary?: string | null;
  notice_period?: string | null;
  resume_text?: string | null;
  flagged?: boolean;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type CandidateSkillRow = {
  id: string;
  candidate_id: string;
  skill: string;
  years: number;
  created_at: string;
  updated_at: string;
}
export type CandidateSkillInsert = {
  id?: string;
  candidate_id: string;
  skill: string;
  years?: number;
  created_at?: string;
  updated_at?: string;
}

export type CandidateCertificationRow = {
  id: string;
  candidate_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
export type CandidateCertificationInsert = {
  id?: string;
  candidate_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export type CandidateTagRow = {
  id: string;
  candidate_id: string;
  tag: string;
  created_at: string;
  updated_at: string;
}
export type CandidateTagInsert = {
  id?: string;
  candidate_id: string;
  tag: string;
  created_at?: string;
  updated_at?: string;
}

export type ApplicationRow = {
  id: string;
  candidate_id: string;
  job_id: string;
  stage: PipelineStage;
  stage_entered_at: string;
  applied_at: string;
  match_score: number | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type ApplicationInsert = {
  id?: string;
  candidate_id: string;
  job_id: string;
  stage?: PipelineStage;
  stage_entered_at?: string;
  applied_at?: string;
  match_score?: number | null;
  scored_at?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type NoteRow = {
  id: string;
  candidate_id: string;
  author_id: string | null;
  category: NoteCategory;
  body: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type NoteInsert = {
  id?: string;
  candidate_id: string;
  author_id?: string | null;
  category?: NoteCategory;
  body: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type ScorecardRow = {
  id: string;
  application_id: string;
  interviewer_id: string | null;
  /** `{ [competency: string]: 1..5 }` — weights live in app config. */
  ratings: Json;
  summary: string;
  recommendation: ScorecardRecommendation;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type ScorecardInsert = {
  id?: string;
  application_id: string;
  interviewer_id?: string | null;
  ratings?: Json;
  summary: string;
  recommendation: ScorecardRecommendation;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type InterviewRow = {
  id: string;
  application_id: string;
  interviewer_id: string;
  starts_at: string;
  type: InterviewType;
  status: InterviewStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type InterviewInsert = {
  id?: string;
  application_id: string;
  interviewer_id: string;
  starts_at: string;
  type?: InterviewType;
  status?: InterviewStatus;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type DocumentRow = {
  id: string;
  candidate_id: string;
  storage_path: string;
  file_name: string;
  category: DocumentCategory;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type DocumentInsert = {
  id?: string;
  candidate_id: string;
  storage_path: string;
  file_name: string;
  category?: DocumentCategory;
  uploaded_by?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type EmailTemplateRow = {
  id: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type EmailTemplateInsert = {
  id?: string;
  name: string;
  category?: EmailTemplateCategory;
  subject: string;
  body: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export type EmailLogRow = {
  id: string;
  candidate_id: string;
  template_id: string | null;
  to_email: string;
  subject: string;
  status: EmailStatus;
  resend_id: string | null;
  created_at: string;
  updated_at: string;
}
export type EmailLogInsert = {
  id?: string;
  candidate_id: string;
  template_id?: string | null;
  to_email: string;
  subject: string;
  status?: EmailStatus;
  resend_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ActivityLogRow = {
  id: string;
  candidate_id: string;
  /** null = system-generated entry (e.g. DB trigger). */
  actor_id: string | null;
  type: ActivityType;
  body: string;
  created_at: string;
  updated_at: string;
}
export type ActivityLogInsert = {
  id?: string;
  candidate_id: string;
  actor_id?: string | null;
  type: ActivityType;
  body: string;
  created_at?: string;
  updated_at?: string;
}

export type SettingsRow = {
  id: string;
  singleton: boolean;
  stalled_days: number;
  stalled_enabled: boolean;
  created_at: string;
  updated_at: string;
}
export type SettingsInsert = {
  id?: string;
  singleton?: boolean;
  stalled_days?: number;
  stalled_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

/* ------------------------------------------------------------------ */
/* Database interface (supabase-js codegen shape)                      */
/* ------------------------------------------------------------------ */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      clients: {
        Row: ClientRow;
        Insert: ClientInsert;
        Update: Partial<ClientInsert>;
        Relationships: [];
      };
      jobs: {
        Row: JobRow;
        Insert: JobInsert;
        Update: Partial<JobInsert>;
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      job_skills: {
        Row: JobSkillRow;
        Insert: JobSkillInsert;
        Update: Partial<JobSkillInsert>;
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_notes: {
        Row: JobNoteRow;
        Insert: JobNoteInsert;
        Update: Partial<JobNoteInsert>;
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: CandidateRow;
        Insert: CandidateInsert;
        Update: Partial<CandidateInsert>;
        Relationships: [];
      };
      candidate_skills: {
        Row: CandidateSkillRow;
        Insert: CandidateSkillInsert;
        Update: Partial<CandidateSkillInsert>;
        Relationships: [
          {
            foreignKeyName: "candidate_skills_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_certifications: {
        Row: CandidateCertificationRow;
        Insert: CandidateCertificationInsert;
        Update: Partial<CandidateCertificationInsert>;
        Relationships: [
          {
            foreignKeyName: "candidate_certifications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_tags: {
        Row: CandidateTagRow;
        Insert: CandidateTagInsert;
        Update: Partial<CandidateTagInsert>;
        Relationships: [
          {
            foreignKeyName: "candidate_tags_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: ApplicationRow;
        Insert: ApplicationInsert;
        Update: Partial<ApplicationInsert>;
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: NoteRow;
        Insert: NoteInsert;
        Update: Partial<NoteInsert>;
        Relationships: [
          {
            foreignKeyName: "notes_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scorecards: {
        Row: ScorecardRow;
        Insert: ScorecardInsert;
        Update: Partial<ScorecardInsert>;
        Relationships: [
          {
            foreignKeyName: "scorecards_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scorecards_interviewer_id_fkey";
            columns: ["interviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      interviews: {
        Row: InterviewRow;
        Insert: InterviewInsert;
        Update: Partial<InterviewInsert>;
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interviews_interviewer_id_fkey";
            columns: ["interviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: Partial<DocumentInsert>;
        Relationships: [
          {
            foreignKeyName: "documents_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: EmailTemplateRow;
        Insert: EmailTemplateInsert;
        Update: Partial<EmailTemplateInsert>;
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_log: {
        Row: EmailLogRow;
        Insert: EmailLogInsert;
        Update: Partial<EmailLogInsert>;
        Relationships: [
          {
            foreignKeyName: "email_log_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_log_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_log: {
        Row: ActivityLogRow;
        Insert: ActivityLogInsert;
        Update: Partial<ActivityLogInsert>;
        Relationships: [
          {
            foreignKeyName: "activity_log_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: SettingsRow;
        Insert: SettingsInsert;
        Update: Partial<SettingsInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole | null;
      };
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      has_role: {
        Args: { required: UserRole[] };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      job_status: JobStatus;
      visa_requirement: VisaRequirement;
      candidate_source: CandidateSource;
      pipeline_stage: PipelineStage;
      note_category: NoteCategory;
      scorecard_recommendation: ScorecardRecommendation;
      interview_type: InterviewType;
      interview_status: InterviewStatus;
      document_category: DocumentCategory;
      email_template_category: EmailTemplateCategory;
      email_status: EmailStatus;
      activity_type: ActivityType;
    };
    CompositeTypes: Record<string, never>;
  };
}

/* ------------------------------------------------------------------ */
/* Lookup helpers (same ergonomics as supabase codegen helpers)        */
/* ------------------------------------------------------------------ */

export type TableName = keyof Database["public"]["Tables"];

export type Tables<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/** Name of the private Storage bucket holding candidate files. */
export const DOCUMENTS_BUCKET = "documents";
