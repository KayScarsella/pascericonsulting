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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assessment_sessions: {
        Row: {
          created_at: string | null
          evaluation_code: number
          final_outcome: string | null
          id: string
          metadata: Json | null
          parent_session_id: string | null
          session_type: string
          status: string | null
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          evaluation_code?: number
          final_outcome?: string | null
          id?: string
          metadata?: Json | null
          parent_session_id?: string | null
          session_type: string
          status?: string | null
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          evaluation_code?: number
          final_outcome?: string | null
          id?: string
          metadata?: Json | null
          parent_session_id?: string | null
          session_type?: string
          status?: string | null
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_parent_fk"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      country: {
        Row: {
          conflicts: boolean | null
          corruption_code: Database["public"]["Enums"]["Corruption_Code"] | null
          country_name: string | null
          country_risk: Database["public"]["Enums"]["country_risk"] | null
          extra_eu: boolean | null
          fao: number | null
          flegt_partner: boolean
          FSI: number | null
          id: string
          ILO: number | null
          RLI: number | null
          sanction: boolean | null
        }
        Insert: {
          conflicts?: boolean | null
          corruption_code?:
            | Database["public"]["Enums"]["Corruption_Code"]
            | null
          country_name?: string | null
          country_risk?: Database["public"]["Enums"]["country_risk"] | null
          extra_eu?: boolean | null
          fao?: number | null
          flegt_partner?: boolean
          FSI?: number | null
          id?: string
          ILO?: number | null
          RLI?: number | null
          sanction?: boolean | null
        }
        Update: {
          conflicts?: boolean | null
          corruption_code?:
            | Database["public"]["Enums"]["Corruption_Code"]
            | null
          country_name?: string | null
          country_risk?: Database["public"]["Enums"]["country_risk"] | null
          extra_eu?: boolean | null
          fao?: number | null
          flegt_partner?: boolean
          FSI?: number | null
          id?: string
          ILO?: number | null
          RLI?: number | null
          sanction?: boolean | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          mime_type: string | null
          name: string
          parent_id: string | null
          size: number | null
          storage_path: string | null
          tool_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          mime_type?: string | null
          name: string
          parent_id?: string | null
          size?: number | null
          storage_path?: string | null
          tool_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          parent_id?: string | null
          size?: number | null
          storage_path?: string | null
          tool_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      eu_products: {
        Row: {
          description: string | null
          eu_code: string | null
          id: string
          is_timber: boolean | null
          order: number | null
        }
        Insert: {
          description?: string | null
          eu_code?: string | null
          id?: string
          is_timber?: boolean | null
          order?: number | null
        }
        Update: {
          description?: string | null
          eu_code?: string | null
          id?: string
          is_timber?: boolean | null
          order?: number | null
        }
        Relationships: []
      }
      mitigation_history: {
        Row: {
          comment: string | null
          file_path: string | null
          id: string
          mitigated_at: string
          new_answer: string
          previous_answer: string | null
          question_id: string
          session_id: string
        }
        Insert: {
          comment?: string | null
          file_path?: string | null
          id?: string
          mitigated_at?: string
          new_answer: string
          previous_answer?: string | null
          question_id: string
          session_id: string
        }
        Update: {
          comment?: string | null
          file_path?: string | null
          id?: string
          mitigated_at?: string
          new_answer?: string
          previous_answer?: string | null
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitigation_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          message: string | null
          title: string
          tool_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          title: string
          tool_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          title?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          attivita: string | null
          avatar_url: string | null
          cap: string | null
          cf_partita_iva: string | null
          citta: string | null
          email: string | null
          full_name: string | null
          id: string
          indirizzo: string | null
          invited_at: string | null
          must_reset_password: boolean
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          provincia: string | null
          ragione_sociale: string | null
          recapito_telefonico: string | null
          settore_merceologico: string | null
          sito_internet: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          attivita?: string | null
          avatar_url?: string | null
          cap?: string | null
          cf_partita_iva?: string | null
          citta?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          indirizzo?: string | null
          invited_at?: string | null
          must_reset_password?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          provincia?: string | null
          ragione_sociale?: string | null
          recapito_telefonico?: string | null
          settore_merceologico?: string | null
          sito_internet?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          attivita?: string | null
          avatar_url?: string | null
          cap?: string | null
          cf_partita_iva?: string | null
          citta?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          indirizzo?: string | null
          invited_at?: string | null
          must_reset_password?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          provincia?: string | null
          ragione_sociale?: string | null
          recapito_telefonico?: string | null
          settore_merceologico?: string | null
          sito_internet?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          config: Json | null
          id: string
          order_index: number | null
          section_id: string
          text: string
          type: string
        }
        Insert: {
          config?: Json | null
          id?: string
          order_index?: number | null
          section_id: string
          text: string
          type: string
        }
        Update: {
          config?: Json | null
          id?: string
          order_index?: number | null
          section_id?: string
          text?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          group_name: string | null
          id: string
          logic_rules: Json | null
          order_index: number | null
          render_mode: string | null
          title: string
          tool_id: string
        }
        Insert: {
          group_name?: string | null
          id?: string
          logic_rules?: Json | null
          order_index?: number | null
          render_mode?: string | null
          title: string
          tool_id: string
        }
        Update: {
          group_name?: string | null
          id?: string
          logic_rules?: Json | null
          order_index?: number | null
          render_mode?: string | null
          title?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          cites: number | null
          common_name: string | null
          id: string
          scientific_name: string | null
        }
        Insert: {
          cites?: number | null
          common_name?: string | null
          id?: string
          scientific_name?: string | null
        }
        Update: {
          cites?: number | null
          common_name?: string | null
          id?: string
          scientific_name?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          eori_number: string | null
          id: string
          name: string
          phone: string | null
          tool_id: string
          updated_at: string | null
          user_id: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          eori_number?: string | null
          id?: string
          name: string
          phone?: string | null
          tool_id: string
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          eori_number?: string | null
          id?: string
          name?: string
          phone?: string | null
          tool_id?: string
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_access: {
        Row: {
          created_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          tool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tool_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_access_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          base_path: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          base_path?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          base_path?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      user_responses: {
        Row: {
          answer_json: Json | null
          answer_text: string | null
          created_at: string | null
          file_path: string | null
          id: string
          question_id: string
          session_id: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer_json?: Json | null
          answer_text?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          question_id: string
          session_id: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer_json?: Json | null
          answer_text?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          question_id?: string
          session_id?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_responses_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_recursive_storage_paths: {
        Args: { target_id: string }
        Returns: {
          storage_path: string
        }[]
      }
      get_storage_paths_recursive: {
        Args: { target_id: string }
        Returns: {
          storage_path: string
        }[]
      }
      is_admin_of_tool: { Args: { _tool_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "standard" | "premium" | "admin"
      Corruption_Code: "AA" | "MA" | "MB" | "MM" | "TT"
      country_risk: "RA" | "RB" | "RS"
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
      app_role: ["standard", "premium", "admin"],
      Corruption_Code: ["AA", "MA", "MB", "MM", "TT"],
      country_risk: ["RA", "RB", "RS"],
    },
  },
} as const
