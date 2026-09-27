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
      applications: {
        Row: {
          applied_at: string | null
          contact: string | null
          created_at: string
          follow_up: string | null
          id: string
          notes: string | null
          refnr: string
          resume_version: string | null
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          contact?: string | null
          created_at?: string
          follow_up?: string | null
          id?: string
          notes?: string | null
          refnr: string
          resume_version?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          applied_at?: string | null
          contact?: string | null
          created_at?: string
          follow_up?: string | null
          id?: string
          notes?: string | null
          refnr?: string
          resume_version?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_refnr_fkey"
            columns: ["refnr"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["refnr"]
          },
        ]
      }
      job_details: {
        Row: {
          description: string | null
          fetched_at: string
          raw: Json
          refnr: string
        }
        Insert: {
          description?: string | null
          fetched_at?: string
          raw: Json
          refnr: string
        }
        Update: {
          description?: string | null
          fetched_at?: string
          raw?: Json
          refnr?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_details_refnr_fkey"
            columns: ["refnr"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["refnr"]
          },
        ]
      }
      job_language_analysis: {
        Row: {
          analysed_at: string
          cefr_level: string | null
          classification: string
          english_accessible: boolean | null
          evidence: string[]
          extraction_version: number
          german_required: boolean | null
          refnr: string
        }
        Insert: {
          analysed_at?: string
          cefr_level?: string | null
          classification?: string
          english_accessible?: boolean | null
          evidence?: string[]
          extraction_version?: number
          german_required?: boolean | null
          refnr: string
        }
        Update: {
          analysed_at?: string
          cefr_level?: string | null
          classification?: string
          english_accessible?: boolean | null
          evidence?: string[]
          extraction_version?: number
          german_required?: boolean | null
          refnr?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_language_analysis_refnr_fkey"
            columns: ["refnr"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["refnr"]
          },
        ]
      }
      jobs: {
        Row: {
          alle_berufe: string[]
          beruf: string | null
          berufsfelder: string[]
          changed_at: string | null
          city: string | null
          city_raw: string | null
          contract: string | null
          country: string | null
          employer: string | null
          employer_hash: string | null
          entry_from: string | null
          expired: boolean
          external_url: string | null
          first_published: string | null
          first_seen: string
          fulltime: boolean | null
          homeoffice: boolean | null
          keywords: string[]
          last_seen: string
          lat: number | null
          lng: number | null
          parttime: boolean | null
          plz: string | null
          published_from: string | null
          raw: Json
          refnr: string
          region: string | null
          salary_from: number | null
          salary_to: number | null
          salary_type: string | null
          title: string
        }
        Insert: {
          alle_berufe?: string[]
          beruf?: string | null
          berufsfelder?: string[]
          changed_at?: string | null
          city?: string | null
          city_raw?: string | null
          contract?: string | null
          country?: string | null
          employer?: string | null
          employer_hash?: string | null
          entry_from?: string | null
          expired?: boolean
          external_url?: string | null
          first_published?: string | null
          first_seen?: string
          fulltime?: boolean | null
          homeoffice?: boolean | null
          keywords?: string[]
          last_seen?: string
          lat?: number | null
          lng?: number | null
          parttime?: boolean | null
          plz?: string | null
          published_from?: string | null
          raw: Json
          refnr: string
          region?: string | null
          salary_from?: number | null
          salary_to?: number | null
          salary_type?: string | null
          title: string
        }
        Update: {
          alle_berufe?: string[]
          beruf?: string | null
          berufsfelder?: string[]
          changed_at?: string | null
          city?: string | null
          city_raw?: string | null
          contract?: string | null
          country?: string | null
          employer?: string | null
          employer_hash?: string | null
          entry_from?: string | null
          expired?: boolean
          external_url?: string | null
          first_published?: string | null
          first_seen?: string
          fulltime?: boolean | null
          homeoffice?: boolean | null
          keywords?: string[]
          last_seen?: string
          lat?: number | null
          lng?: number | null
          parttime?: boolean | null
          plz?: string | null
          published_from?: string | null
          raw?: Json
          refnr?: string
          region?: string | null
          salary_from?: number | null
          salary_to?: number | null
          salary_type?: string | null
          title?: string
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          active_jobs: number
          analysed_jobs: number
          city: string
          created_at: string
          employers: number
          english_accessible: number
          expired_jobs: number
          german_required: number
          id: string
          new_7d: number
          remote_pct: number
          salary_pct: number
          snapshot_date: string
        }
        Insert: {
          active_jobs?: number
          analysed_jobs?: number
          city?: string
          created_at?: string
          employers?: number
          english_accessible?: number
          expired_jobs?: number
          german_required?: number
          id?: string
          new_7d?: number
          remote_pct?: number
          salary_pct?: number
          snapshot_date?: string
        }
        Update: {
          active_jobs?: number
          analysed_jobs?: number
          city?: string
          created_at?: string
          employers?: number
          english_accessible?: number
          expired_jobs?: number
          german_required?: number
          id?: string
          new_7d?: number
          remote_pct?: number
          salary_pct?: number
          snapshot_date?: string
        }
        Relationships: []
      }
      search_keywords: {
        Row: {
          active: boolean
          created_at: string
          id: string
          term: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          term: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          term?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          errors: Json
          expired_count: number
          fetched: number
          finished_at: string | null
          id: string
          keywords_done: number
          keywords_total: number
          new_count: number
          requests: number
          skipped_non_de: number
          started_at: string
          status: string
          trigger: string
          updated_count: number
        }
        Insert: {
          errors?: Json
          expired_count?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          keywords_done?: number
          keywords_total?: number
          new_count?: number
          requests?: number
          skipped_non_de?: number
          started_at?: string
          status?: string
          trigger?: string
          updated_count?: number
        }
        Update: {
          errors?: Json
          expired_count?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          keywords_done?: number
          keywords_total?: number
          new_count?: number
          requests?: number
          skipped_non_de?: number
          started_at?: string
          status?: string
          trigger?: string
          updated_count?: number
        }
        Relationships: []
      }
      tracked_cities: {
        Row: {
          city: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      city_employer_share: {
        Row: {
          city: string | null
          top_employer_pct: number | null
        }
        Relationships: []
      }
      city_stats: {
        Row: {
          active_jobs: number | null
          avg_salary: number | null
          city: string | null
          employers: number | null
          first_seen: string | null
          last_seen: string | null
          new_30d: number | null
          new_7d: number | null
          permanent_pct: number | null
          remote_pct: number | null
          salary_pct: number | null
          total_jobs: number | null
        }
        Relationships: []
      }
      employer_stats: {
        Row: {
          active_jobs: number | null
          cities: number | null
          city_list: string[] | null
          employer: string | null
          first_seen: string | null
          last_seen: string | null
          total_jobs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      set_daily_sync_token: { Args: { t: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
