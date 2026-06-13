export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_id: string | null
          body: string
          candidate_id: string
          created_at: string
          id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          candidate_id: string
          created_at?: string
          id?: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          candidate_id?: string
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string
          archived_at: string | null
          candidate_id: string
          created_at: string
          id: string
          job_id: string
          match_score: number | null
          scored_at: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          archived_at?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          job_id: string
          match_score?: number | null
          scored_at?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          archived_at?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          job_id?: string
          match_score?: number | null
          scored_at?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_certifications: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_certifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_skills: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          skill: string
          updated_at: string
          years: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          skill: string
          updated_at?: string
          years?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          skill?: string
          updated_at?: string
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tags: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          tag: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          tag: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          expected_salary: string | null
          flagged: boolean
          full_name: string
          id: string
          location: string | null
          notice_period: string | null
          phone: string | null
          resume_text: string | null
          source: Database["public"]["Enums"]["candidate_source"]
          summary: string | null
          updated_at: string
          years_exp: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          expected_salary?: string | null
          flagged?: boolean
          full_name: string
          id?: string
          location?: string | null
          notice_period?: string | null
          phone?: string | null
          resume_text?: string | null
          source?: Database["public"]["Enums"]["candidate_source"]
          summary?: string | null
          updated_at?: string
          years_exp?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          expected_salary?: string | null
          flagged?: boolean
          full_name?: string
          id?: string
          location?: string | null
          notice_period?: string | null
          phone?: string | null
          resume_text?: string | null
          source?: Database["public"]["Enums"]["candidate_source"]
          summary?: string | null
          updated_at?: string
          years_exp?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          archived_at: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          archived_at: string | null
          candidate_id: string
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          file_name: string
          id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          archived_at?: string | null
          candidate_id: string
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_name: string
          id?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          archived_at?: string | null
          candidate_id?: string
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_name?: string
          id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          resend_id: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id: string | null
          to_email: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          resend_id?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id?: string | null
          to_email: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          resend_id?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_id?: string | null
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          archived_at: string | null
          body: string
          category: Database["public"]["Enums"]["email_template_category"]
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          category?: Database["public"]["Enums"]["email_template_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          category?: Database["public"]["Enums"]["email_template_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          application_id: string
          archived_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          interviewer_id: string
          starts_at: string
          status: Database["public"]["Enums"]["interview_status"]
          type: Database["public"]["Enums"]["interview_type"]
          updated_at: string
        }
        Insert: {
          application_id: string
          archived_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          archived_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          archived_at: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          job_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          job_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_skills: {
        Row: {
          created_at: string
          id: string
          job_id: string
          skill: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          skill: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          skill?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          jd_text: string | null
          location: string | null
          min_years: number
          opened_at: string
          requirements: string[]
          salary_range: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          visa: Database["public"]["Enums"]["visa_requirement"]
          visa_notes: string | null
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          jd_text?: string | null
          location?: string | null
          min_years?: number
          opened_at?: string
          requirements?: string[]
          salary_range?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          visa?: Database["public"]["Enums"]["visa_requirement"]
          visa_notes?: string | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          jd_text?: string | null
          location?: string | null
          min_years?: number
          opened_at?: string
          requirements?: string[]
          salary_range?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          visa?: Database["public"]["Enums"]["visa_requirement"]
          visa_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived_at: string | null
          author_id: string | null
          body: string
          candidate_id: string
          category: Database["public"]["Enums"]["note_category"]
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id?: string | null
          body: string
          candidate_id: string
          category?: Database["public"]["Enums"]["note_category"]
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string | null
          body?: string
          candidate_id?: string
          category?: Database["public"]["Enums"]["note_category"]
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scorecards: {
        Row: {
          application_id: string
          archived_at: string | null
          created_at: string
          id: string
          interviewer_id: string | null
          ratings: Json
          recommendation: Database["public"]["Enums"]["scorecard_recommendation"]
          summary: string
          updated_at: string
        }
        Insert: {
          application_id: string
          archived_at?: string | null
          created_at?: string
          id?: string
          interviewer_id?: string | null
          ratings?: Json
          recommendation: Database["public"]["Enums"]["scorecard_recommendation"]
          summary: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          interviewer_id?: string | null
          ratings?: Json
          recommendation?: Database["public"]["Enums"]["scorecard_recommendation"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecards_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          singleton: boolean
          stalled_days: number
          stalled_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          singleton?: boolean
          stalled_days?: number
          stalled_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          singleton?: boolean
          stalled_days?: number
          stalled_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: { required: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      activity_type:
        | "stage"
        | "note"
        | "email"
        | "doc"
        | "interview"
        | "tag"
        | "flag"
        | "scorecard"
        | "system"
      candidate_source:
        | "linkedin"
        | "referral"
        | "job_portal"
        | "indeed"
        | "agency"
        | "other"
      document_category:
        | "resume"
        | "portfolio"
        | "certification"
        | "offer_letter"
        | "other"
      email_status: "queued" | "sent" | "delivered" | "opened" | "bounced"
      email_template_category:
        | "interview"
        | "rejection"
        | "offer"
        | "update"
        | "outreach"
        | "other"
      interview_status: "scheduled" | "completed" | "cancelled"
      interview_type:
        | "phone_screen"
        | "hr_interview"
        | "technical"
        | "panel"
        | "final_panel"
        | "client_interview"
        | "other"
      job_status: "open" | "on_hold" | "closed"
      note_category:
        | "general"
        | "screening"
        | "interview_feedback"
        | "client_feedback"
        | "technical"
        | "compensation"
      pipeline_stage:
        | "applied"
        | "screening"
        | "interview"
        | "offer"
        | "hired"
        | "rejected"
      scorecard_recommendation: "strong_hire" | "hire" | "consider" | "no_hire"
      user_role: "admin" | "recruiter" | "hiring_manager"
      visa_requirement:
        | "TN_CANADIAN_ONLY"
        | "TN_CANADIAN_OR_MEXICAN"
        | "US_CITIZEN_GC_ONLY"
        | "H1B_TRANSFER"
        | "SPONSORSHIP_AVAILABLE"
        | "LOCAL"
        | "UNSPECIFIED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "stage",
        "note",
        "email",
        "doc",
        "interview",
        "tag",
        "flag",
        "scorecard",
        "system",
      ],
      candidate_source: [
        "linkedin",
        "referral",
        "job_portal",
        "indeed",
        "agency",
        "other",
      ],
      document_category: [
        "resume",
        "portfolio",
        "certification",
        "offer_letter",
        "other",
      ],
      email_status: ["queued", "sent", "delivered", "opened", "bounced"],
      email_template_category: [
        "interview",
        "rejection",
        "offer",
        "update",
        "outreach",
        "other",
      ],
      interview_status: ["scheduled", "completed", "cancelled"],
      interview_type: [
        "phone_screen",
        "hr_interview",
        "technical",
        "panel",
        "final_panel",
        "client_interview",
        "other",
      ],
      job_status: ["open", "on_hold", "closed"],
      note_category: [
        "general",
        "screening",
        "interview_feedback",
        "client_feedback",
        "technical",
        "compensation",
      ],
      pipeline_stage: [
        "applied",
        "screening",
        "interview",
        "offer",
        "hired",
        "rejected",
      ],
      scorecard_recommendation: ["strong_hire", "hire", "consider", "no_hire"],
      user_role: ["admin", "recruiter", "hiring_manager"],
      visa_requirement: [
        "TN_CANADIAN_ONLY",
        "TN_CANADIAN_OR_MEXICAN",
        "US_CITIZEN_GC_ONLY",
        "H1B_TRANSFER",
        "SPONSORSHIP_AVAILABLE",
        "LOCAL",
        "UNSPECIFIED",
      ],
    },
  },
} as const
