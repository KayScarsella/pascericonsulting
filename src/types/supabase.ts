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
          cpi_23: number | null
          cpi_24: number | null
          cpi_25: number | null
          fao: number | null
          flegt_partner: boolean
          id: string
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
          cpi_23?: number | null
          cpi_24?: number | null
          cpi_25?: number | null
          fao?: number | null
          flegt_partner?: boolean
          id?: string
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
          cpi_23?: number | null
          cpi_24?: number | null
          cpi_25?: number | null
          fao?: number | null
          flegt_partner?: boolean
          id?: string
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
          min_role: Database["public"]["Enums"]["app_role"]
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
          min_role?: Database["public"]["Enums"]["app_role"]
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
          min_role?: Database["public"]["Enums"]["app_role"]
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
      fsc_alert_outbox: {
        Row: {
          alert_kind: string
          company_id: string
          created_at: string
          id: string
          message: string | null
          notification_id: string | null
          recipient_user_id: string
          sent_at: string | null
          source_id: string
          source_table: string
          target_date: string
          title: string
          tool_id: string
        }
        Insert: {
          alert_kind: string
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          notification_id?: string | null
          recipient_user_id: string
          sent_at?: string | null
          source_id: string
          source_table: string
          target_date: string
          title: string
          tool_id: string
        }
        Update: {
          alert_kind?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          notification_id?: string | null
          recipient_user_id?: string
          sent_at?: string | null
          source_id?: string
          source_table?: string
          target_date?: string
          title?: string
          tool_id?: string
        }
        Relationships: []
      }
      fsc_companies: {
        Row: {
          cap: string | null
          cf_partita_iva: string | null
          citta: string | null
          created_at: string
          email: string | null
          id: string
          indirizzo: string | null
          provincia: string | null
          ragione_sociale: string
          recapito_telefonico: string | null
          sito_internet: string | null
          tool_id: string
          updated_at: string
        }
        Insert: {
          cap?: string | null
          cf_partita_iva?: string | null
          citta?: string | null
          created_at?: string
          email?: string | null
          id?: string
          indirizzo?: string | null
          provincia?: string | null
          ragione_sociale: string
          recapito_telefonico?: string | null
          sito_internet?: string | null
          tool_id: string
          updated_at?: string
        }
        Update: {
          cap?: string | null
          cf_partita_iva?: string | null
          citta?: string | null
          created_at?: string
          email?: string | null
          id?: string
          indirizzo?: string | null
          provincia?: string | null
          ragione_sociale?: string
          recapito_telefonico?: string | null
          sito_internet?: string | null
          tool_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fsc_company_members: {
        Row: {
          can_edit: boolean
          company_id: string
          created_at: string
          member_type: Database["public"]["Enums"]["fsc_member_type"]
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          company_id: string
          created_at?: string
          member_type?: Database["public"]["Enums"]["fsc_member_type"]
          user_id: string
        }
        Update: {
          can_edit?: boolean
          company_id?: string
          created_at?: string
          member_type?: Database["public"]["Enums"]["fsc_member_type"]
          user_id?: string
        }
        Relationships: []
      }
      fsc_company_product_group_claims: {
        Row: {
          claim: Database["public"]["Enums"]["fsc_product_claim"]
          company_product_group_id: string
        }
        Insert: {
          claim: Database["public"]["Enums"]["fsc_product_claim"]
          company_product_group_id: string
        }
        Update: {
          claim?: Database["public"]["Enums"]["fsc_product_claim"]
          company_product_group_id?: string
        }
        Relationships: []
      }
      fsc_company_product_groups: {
        Row: {
          activated_at: string
          catalog_group_id: string | null
          company_id: string
          created_at: string
          custom_label: string | null
          id: string
          is_active: boolean
          species_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          catalog_group_id?: string | null
          company_id: string
          created_at?: string
          custom_label?: string | null
          id?: string
          is_active?: boolean
          species_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          catalog_group_id?: string | null
          company_id?: string
          created_at?: string
          custom_label?: string | null
          id?: string
          is_active?: boolean
          species_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fsc_document_alerts: {
        Row: {
          alert_type: string
          created_at: string
          document_id: string
          id: string
          recipient_user_id: string | null
          sent_at: string | null
        }
        Insert: {
          alert_type?: string
          created_at?: string
          document_id: string
          id?: string
          recipient_user_id?: string | null
          sent_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          document_id?: string
          id?: string
          recipient_user_id?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      fsc_documents: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          mime_type: string | null
          module: Database["public"]["Enums"]["fsc_document_module"]
          name: string
          parent_document_id: string | null
          reference_year: number | null
          reviewed_at: string | null
          size: number | null
          status: Database["public"]["Enums"]["fsc_document_status"]
          storage_path: string | null
          tool_id: string
          updated_at: string
          version: number
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          mime_type?: string | null
          module: Database["public"]["Enums"]["fsc_document_module"]
          name: string
          parent_document_id?: string | null
          reference_year?: number | null
          reviewed_at?: string | null
          size?: number | null
          status?: Database["public"]["Enums"]["fsc_document_status"]
          storage_path?: string | null
          tool_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          mime_type?: string | null
          module?: Database["public"]["Enums"]["fsc_document_module"]
          name?: string
          parent_document_id?: string | null
          reference_year?: number | null
          reviewed_at?: string | null
          size?: number | null
          status?: Database["public"]["Enums"]["fsc_document_status"]
          storage_path?: string | null
          tool_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      fsc_ilo_assessments: {
        Row: {
          company_id: string
          compiled_doc_path: string | null
          compiled_pdf_path: string | null
          completed_at: string | null
          created_at: string
          id: string
          reference_year: number
          template_storage_path: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          compiled_doc_path?: string | null
          compiled_pdf_path?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          reference_year: number
          template_storage_path?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          compiled_doc_path?: string | null
          compiled_pdf_path?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          reference_year?: number
          template_storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fsc_logos: {
        Row: {
          approval_email_path: string | null
          company_id: string
          created_at: string
          created_by: string | null
          graphic_path: string | null
          id: string
          logo_type: Database["public"]["Enums"]["fsc_logo_type"]
          notes: string | null
          progressive_code: string
        }
        Insert: {
          approval_email_path?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          graphic_path?: string | null
          id?: string
          logo_type: Database["public"]["Enums"]["fsc_logo_type"]
          notes?: string | null
          progressive_code?: string
        }
        Update: {
          approval_email_path?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          graphic_path?: string | null
          id?: string
          logo_type?: Database["public"]["Enums"]["fsc_logo_type"]
          notes?: string | null
          progressive_code?: string
        }
        Relationships: []
      }
      fsc_product_group_addenda: {
        Row: {
          company_product_group_id: string
          generated_at: string
          id: string
          metadata: Json
          storage_path: string | null
        }
        Insert: {
          company_product_group_id: string
          generated_at?: string
          id?: string
          metadata?: Json
          storage_path?: string | null
        }
        Update: {
          company_product_group_id?: string
          generated_at?: string
          id?: string
          metadata?: Json
          storage_path?: string | null
        }
        Relationships: []
      }
      fsc_product_groups_catalog: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          keywords: string | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fsc_subcontractor_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["fsc_subcontractor_attachment_type"]
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          size: number | null
          storage_path: string
          subcontractor_id: string
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["fsc_subcontractor_attachment_type"]
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path: string
          subcontractor_id: string
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["fsc_subcontractor_attachment_type"]
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path?: string
          subcontractor_id?: string
        }
        Relationships: []
      }
      fsc_subcontractors: {
        Row: {
          certificate_number: string | null
          certificate_valid_until: string | null
          coc_risk: boolean
          company_id: string
          control_frequency: Database["public"]["Enums"]["fsc_control_frequency"]
          created_at: string
          deactivated_at: string | null
          id: string
          is_certified: boolean
          last_control_date: string | null
          ragione_sociale: string
          status: Database["public"]["Enums"]["fsc_supplier_status"]
          updated_at: string
          work_type: string | null
        }
        Insert: {
          certificate_number?: string | null
          certificate_valid_until?: string | null
          coc_risk?: boolean
          company_id: string
          control_frequency?: Database["public"]["Enums"]["fsc_control_frequency"]
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_certified?: boolean
          last_control_date?: string | null
          ragione_sociale: string
          status?: Database["public"]["Enums"]["fsc_supplier_status"]
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          certificate_number?: string | null
          certificate_valid_until?: string | null
          coc_risk?: boolean
          company_id?: string
          control_frequency?: Database["public"]["Enums"]["fsc_control_frequency"]
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_certified?: boolean
          last_control_date?: string | null
          ragione_sociale?: string
          status?: Database["public"]["Enums"]["fsc_supplier_status"]
          updated_at?: string
          work_type?: string | null
        }
        Relationships: []
      }
      fsc_supplier_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["fsc_supplier_attachment_type"]
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          size: number | null
          storage_path: string
          supplier_id: string
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["fsc_supplier_attachment_type"]
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path: string
          supplier_id: string
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["fsc_supplier_attachment_type"]
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path?: string
          supplier_id?: string
        }
        Relationships: []
      }
      fsc_supplier_product_claims: {
        Row: {
          claim: Database["public"]["Enums"]["fsc_product_claim"]
          supplier_id: string
        }
        Insert: {
          claim: Database["public"]["Enums"]["fsc_product_claim"]
          supplier_id: string
        }
        Update: {
          claim?: Database["public"]["Enums"]["fsc_product_claim"]
          supplier_id?: string
        }
        Relationships: []
      }
      fsc_supplier_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["fsc_supplier_status"]
          old_status: Database["public"]["Enums"]["fsc_supplier_status"] | null
          supplier_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["fsc_supplier_status"]
          old_status?: Database["public"]["Enums"]["fsc_supplier_status"] | null
          supplier_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["fsc_supplier_status"]
          old_status?: Database["public"]["Enums"]["fsc_supplier_status"] | null
          supplier_id?: string
        }
        Relationships: []
      }
      fsc_suppliers: {
        Row: {
          certificate_number: string | null
          certificate_valid_until: string | null
          company_id: string
          control_frequency: Database["public"]["Enums"]["fsc_control_frequency"]
          created_at: string
          deactivated_at: string | null
          id: string
          last_control_date: string | null
          ragione_sociale: string
          status: Database["public"]["Enums"]["fsc_supplier_status"]
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          certificate_valid_until?: string | null
          company_id: string
          control_frequency?: Database["public"]["Enums"]["fsc_control_frequency"]
          created_at?: string
          deactivated_at?: string | null
          id?: string
          last_control_date?: string | null
          ragione_sociale: string
          status?: Database["public"]["Enums"]["fsc_supplier_status"]
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          certificate_valid_until?: string | null
          company_id?: string
          control_frequency?: Database["public"]["Enums"]["fsc_control_frequency"]
          created_at?: string
          deactivated_at?: string | null
          id?: string
          last_control_date?: string | null
          ragione_sociale?: string
          status?: Database["public"]["Enums"]["fsc_supplier_status"]
          updated_at?: string
        }
        Relationships: []
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
      fsc_ensure_company_for_user: { Args: { _tool_id: string }; Returns: string }
      fsc_current_user_company_ids: { Args: Record<string, never>; Returns: string[] }
      fsc_process_alert_outbox: { Args: { _tool_id: string }; Returns: number }
      fsc_next_logo_code: { Args: { _company_id: string }; Returns: string }
    }
    Enums: {
      app_role: "standard" | "premium" | "admin"
      Corruption_Code: "AA" | "MA" | "MB" | "MM" | "TT"
      country_risk: "RA" | "RB" | "RS"
      fsc_control_frequency: "annual" | "semiannual"
      fsc_document_module: "gestione" | "ente"
      fsc_document_status: "active" | "archived"
      fsc_logo_type: "product" | "promotional"
      fsc_member_type: "owner" | "employee" | "consultant"
      fsc_product_claim: "fsc_100" | "fsc_mix" | "fsc_recycled"
      fsc_subcontractor_attachment_type: "certificato" | "accordo_conto_lavoro"
      fsc_supplier_attachment_type: "visura" | "due_diligence" | "dichiarazione"
      fsc_supplier_status: "active" | "inactive" | "reactivated"
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
      fsc_control_frequency: ["annual", "semiannual"],
      fsc_document_module: ["gestione", "ente"],
      fsc_document_status: ["active", "archived"],
      fsc_logo_type: ["product", "promotional"],
      fsc_member_type: ["owner", "employee", "consultant"],
      fsc_product_claim: ["fsc_100", "fsc_mix", "fsc_recycled"],
      fsc_subcontractor_attachment_type: ["certificato", "accordo_conto_lavoro"],
      fsc_supplier_attachment_type: ["visura", "due_diligence", "dichiarazione"],
      fsc_supplier_status: ["active", "inactive", "reactivated"],
    },
  },
} as const
