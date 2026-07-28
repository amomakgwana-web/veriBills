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
      access_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          issued_by: string
          max_uses: number
          org_id: string
          property_id: string
          purpose: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["access_code_status"]
          type: Database["public"]["Enums"]["access_code_type"]
          unit_id: string | null
          use_count: number
          valid_from: string
          valid_until: string
          vehicle_registration: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          issued_by: string
          max_uses?: number
          org_id: string
          property_id: string
          purpose?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["access_code_status"]
          type?: Database["public"]["Enums"]["access_code_type"]
          unit_id?: string | null
          use_count?: number
          valid_from?: string
          valid_until: string
          vehicle_registration?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          issued_by?: string
          max_uses?: number
          org_id?: string
          property_id?: string
          purpose?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["access_code_status"]
          type?: Database["public"]["Enums"]["access_code_type"]
          unit_id?: string | null
          use_count?: number
          valid_from?: string
          valid_until?: string
          vehicle_registration?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      access_events: {
        Row: {
          access_code_id: string | null
          direction: string | null
          gate: string | null
          id: string
          metadata: Json
          occurred_at: string
          org_id: string
          profile_id: string | null
          property_id: string
          result: string
          scanned_code: string | null
        }
        Insert: {
          access_code_id?: string | null
          direction?: string | null
          gate?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          org_id: string
          profile_id?: string | null
          property_id: string
          result?: string
          scanned_code?: string | null
        }
        Update: {
          access_code_id?: string | null
          direction?: string | null
          gate?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          org_id?: string
          profile_id?: string | null
          property_id?: string
          result?: string
          scanned_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_events_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_exports: {
        Row: {
          completed_at: string | null
          created_at: string
          entry_count: number
          error_message: string | null
          exported_by: string | null
          external_reference: string | null
          id: string
          integration_id: string | null
          org_id: string
          period_end: string
          period_start: string
          status: string
          total_credit: number
          total_debit: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entry_count?: number
          error_message?: string | null
          exported_by?: string | null
          external_reference?: string | null
          id?: string
          integration_id?: string | null
          org_id: string
          period_end: string
          period_start: string
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entry_count?: number
          error_message?: string | null
          exported_by?: string | null
          external_reference?: string | null
          id?: string
          integration_id?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_exports_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exports_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachment_urls: string[]
          audience_unit_types: Database["public"]["Enums"]["unit_type"][] | null
          author_id: string | null
          body: string
          category: string
          created_at: string
          expires_at: string | null
          id: string
          is_pinned: boolean
          org_id: string
          property_id: string | null
          publish_at: string
          published_by: string | null
          send_email: boolean
          send_sms: boolean
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          updated_at: string
        }
        Insert: {
          attachment_urls?: string[]
          audience_unit_types?:
            | Database["public"]["Enums"]["unit_type"][]
            | null
          author_id?: string | null
          body: string
          category?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          org_id: string
          property_id?: string | null
          publish_at?: string
          published_by?: string | null
          send_email?: boolean
          send_sms?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          updated_at?: string
        }
        Update: {
          attachment_urls?: string[]
          audience_unit_types?:
            | Database["public"]["Enums"]["unit_type"][]
            | null
          author_id?: string | null
          body?: string
          category?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          org_id?: string
          property_id?: string | null
          publish_at?: string
          published_by?: string | null
          send_email?: boolean
          send_sms?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_decisions: {
        Row: {
          approval_id: string
          comment: string | null
          decided_at: string
          decided_by: string
          decision: string
          id: string
          ip_address: unknown
          signature_name: string | null
        }
        Insert: {
          approval_id: string
          comment?: string | null
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          ip_address?: unknown
          signature_name?: string | null
        }
        Update: {
          approval_id?: string
          comment?: string | null
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          ip_address?: unknown
          signature_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_decisions_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_policies: {
        Row: {
          amount_threshold: number | null
          approver_roles: Database["public"]["Enums"]["org_role"][]
          created_at: string
          id: string
          is_active: boolean
          org_id: string
          required_approvals: number
          type: Database["public"]["Enums"]["approval_type"]
        }
        Insert: {
          amount_threshold?: number | null
          approver_roles?: Database["public"]["Enums"]["org_role"][]
          created_at?: string
          id?: string
          is_active?: boolean
          org_id: string
          required_approvals?: number
          type: Database["public"]["Enums"]["approval_type"]
        }
        Update: {
          amount_threshold?: number | null
          approver_roles?: Database["public"]["Enums"]["org_role"][]
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string
          required_approvals?: number
          type?: Database["public"]["Enums"]["approval_type"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          amount: number | null
          approvals_received: number
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          metadata: Json
          org_id: string
          requested_by: string | null
          required_approvals: number
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_table: string
          title: string
          type: Database["public"]["Enums"]["approval_type"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          approvals_received?: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          org_id: string
          requested_by?: string | null
          required_approvals?: number
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_table: string
          title: string
          type: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          approvals_received?: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          requested_by?: string | null
          required_approvals?: number
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          subject_id?: string
          subject_table?: string
          title?: string
          type?: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          entity_id: string | null
          entity_table: string
          id: number
          ip_address: unknown
          occurred_at: string
          org_id: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_table: string
          id?: number
          ip_address?: unknown
          occurred_at?: string
          org_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_table?: string
          id?: number
          ip_address?: unknown
          occurred_at?: string
          org_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_number_masked: string
          account_type: string | null
          bank_name: string
          branch_code: string
          created_at: string
          credential_ref: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          label: string
          org_id: string
          pending_approval_id: string | null
          pending_change: Json | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder: string
          account_number_masked: string
          account_type?: string | null
          bank_name: string
          branch_code: string
          created_at?: string
          credential_ref?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label: string
          org_id: string
          pending_approval_id?: string | null
          pending_change?: Json | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder?: string
          account_number_masked?: string
          account_type?: string | null
          bank_name?: string
          branch_code?: string
          created_at?: string
          credential_ref?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string
          org_id?: string
          pending_approval_id?: string | null
          pending_change?: Json | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_pending_approval_id_fkey"
            columns: ["pending_approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          error_message: string | null
          id: string
          invoices_created: number
          org_id: string
          period_end: string
          period_start: string
          property_id: string | null
          run_by: string | null
          started_at: string | null
          status: string
          total_billed: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          error_message?: string | null
          id?: string
          invoices_created?: number
          org_id: string
          period_end: string
          period_start: string
          property_id?: string | null
          run_by?: string | null
          started_at?: string | null
          status?: string
          total_billed?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          error_message?: string | null
          id?: string
          invoices_created?: number
          org_id?: string
          period_end?: string
          period_start?: string
          property_id?: string | null
          run_by?: string | null
          started_at?: string | null
          status?: string
          total_billed?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runs_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          approval_id: string | null
          audience_filter: Json
          body: string
          channel: Database["public"]["Enums"]["channel"]
          clicked_count: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_count: number
          expires_at: string | null
          failed_count: number
          id: string
          name: string
          opened_count: number
          org_id: string
          paid_count: number
          property_id: string | null
          reason: string
          recipient_count: number
          requires_approval: boolean
          scheduled_for: string | null
          send_window_end: string | null
          send_window_start: string | null
          sent_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string | null
          template_id: string | null
          throttle_per_hour: number | null
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          audience_filter?: Json
          body: string
          channel: Database["public"]["Enums"]["channel"]
          clicked_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          expires_at?: string | null
          failed_count?: number
          id?: string
          name: string
          opened_count?: number
          org_id: string
          paid_count?: number
          property_id?: string | null
          reason?: string
          recipient_count?: number
          requires_approval?: boolean
          scheduled_for?: string | null
          send_window_end?: string | null
          send_window_start?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          template_id?: string | null
          throttle_per_hour?: number | null
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          audience_filter?: Json
          body?: string
          channel?: Database["public"]["Enums"]["channel"]
          clicked_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          expires_at?: string | null
          failed_count?: number
          id?: string
          name?: string
          opened_count?: number
          org_id?: string
          paid_count?: number
          property_id?: string | null
          reason?: string
          recipient_count?: number
          requires_approval?: boolean
          scheduled_for?: string | null
          send_window_end?: string | null
          send_window_start?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          template_id?: string | null
          throttle_per_hour?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_approval_fk"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          escalated_at: string | null
          id: string
          maintenance_request_id: string | null
          org_id: string | null
          profile_id: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          escalated_at?: string | null
          id?: string
          maintenance_request_id?: string | null
          org_id?: string | null
          profile_id: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          escalated_at?: string | null
          id?: string
          maintenance_request_id?: string | null
          org_id?: string | null
          profile_id?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          actions: Json
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          actions?: Json
          author_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          actions?: Json
          author_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_runs: {
        Row: {
          action_date: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          mandate_count: number
          org_id: string
          status: string
          submitted_at: string | null
          successful_count: number
          total_amount: number
        }
        Insert: {
          action_date: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          mandate_count?: number
          org_id: string
          status?: string
          submitted_at?: string | null
          successful_count?: number
          total_amount?: number
        }
        Update: {
          action_date?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          mandate_count?: number
          org_id?: string
          status?: string
          submitted_at?: string | null
          successful_count?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          account_id: string
          action_date: string
          amount: number
          created_at: string
          id: string
          is_tracking_retry: boolean
          mandate_id: string
          org_id: string
          payment_id: string | null
          resolved_at: string | null
          response_code: string | null
          response_reason: string | null
          retry_of: string | null
          run_id: string | null
          status: Database["public"]["Enums"]["collection_status"]
          submitted_at: string | null
        }
        Insert: {
          account_id: string
          action_date: string
          amount: number
          created_at?: string
          id?: string
          is_tracking_retry?: boolean
          mandate_id: string
          org_id: string
          payment_id?: string | null
          resolved_at?: string | null
          response_code?: string | null
          response_reason?: string | null
          retry_of?: string | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          submitted_at?: string | null
        }
        Update: {
          account_id?: string
          action_date?: string
          amount?: number
          created_at?: string
          id?: string
          is_tracking_retry?: boolean
          mandate_id?: string
          org_id?: string
          payment_id?: string | null
          resolved_at?: string | null
          response_code?: string | null
          response_reason?: string | null
          retry_of?: string | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "debicheck_mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_retry_of_fkey"
            columns: ["retry_of"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "collection_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          phone: string | null
          rating: number | null
          trade: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          phone?: string | null
          rating?: number | null
          trade?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          rating?: number | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      debicheck_mandates: {
        Row: {
          account_id: string
          account_number_masked: string
          account_type: string | null
          adjustment_category: string | null
          adjustment_rate: number | null
          authenticated_at: string | null
          authentication_type: string | null
          bank_name: string
          branch_code: string
          cancellation_reason: string | null
          cancelled_at: string | null
          collection_day: number
          contract_reference: string
          created_at: string
          first_collection_date: string
          frequency: Database["public"]["Enums"]["charge_frequency"]
          id: string
          instalment_amount: number
          last_collection_date: string | null
          mandate_reference: string | null
          maximum_amount: number
          metadata: Json
          org_id: string
          profile_id: string
          status: Database["public"]["Enums"]["mandate_status"]
          tracking_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          account_number_masked: string
          account_type?: string | null
          adjustment_category?: string | null
          adjustment_rate?: number | null
          authenticated_at?: string | null
          authentication_type?: string | null
          bank_name: string
          branch_code: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          collection_day: number
          contract_reference: string
          created_at?: string
          first_collection_date: string
          frequency?: Database["public"]["Enums"]["charge_frequency"]
          id?: string
          instalment_amount: number
          last_collection_date?: string | null
          mandate_reference?: string | null
          maximum_amount: number
          metadata?: Json
          org_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["mandate_status"]
          tracking_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_number_masked?: string
          account_type?: string | null
          adjustment_category?: string | null
          adjustment_rate?: number | null
          authenticated_at?: string | null
          authentication_type?: string | null
          bank_name?: string
          branch_code?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          collection_day?: number
          contract_reference?: string
          created_at?: string
          first_collection_date?: string
          frequency?: Database["public"]["Enums"]["charge_frequency"]
          id?: string
          instalment_amount?: number
          last_collection_date?: string | null
          mandate_reference?: string | null
          maximum_amount?: number
          metadata?: Json
          org_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["mandate_status"]
          tracking_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debicheck_mandates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debicheck_mandates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debicheck_mandates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acknowledgements: {
        Row: {
          acknowledged_at: string
          document_id: string
          id: string
          ip_address: unknown
          profile_id: string
          signature_name: string | null
          user_agent: string | null
        }
        Insert: {
          acknowledged_at?: string
          document_id: string
          id?: string
          ip_address?: unknown
          profile_id: string
          signature_name?: string | null
          user_agent?: string | null
        }
        Update: {
          acknowledged_at?: string
          document_id?: string
          id?: string
          ip_address?: unknown
          profile_id?: string
          signature_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          kind: string
          last_value: number
          org_id: string
          year: number
        }
        Insert: {
          kind: string
          last_value?: number
          org_id: string
          year: number
        }
        Update: {
          kind?: string
          last_value?: number
          org_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          lease_id: string | null
          mime_type: string | null
          org_id: string
          profile_id: string | null
          property_id: string | null
          published_at: string | null
          requires_acknowledgement: boolean
          size_bytes: number | null
          storage_path: string
          tenant_visible: boolean
          title: string
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          lease_id?: string | null
          mime_type?: string | null
          org_id: string
          profile_id?: string | null
          property_id?: string | null
          published_at?: string | null
          requires_acknowledgement?: boolean
          size_bytes?: number | null
          storage_path: string
          tenant_visible?: boolean
          title: string
          type: Database["public"]["Enums"]["document_type"]
          unit_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          lease_id?: string | null
          mime_type?: string | null
          org_id?: string
          profile_id?: string | null
          property_id?: string | null
          published_at?: string | null
          requires_acknowledgement?: boolean
          size_bytes?: number | null
          storage_path?: string
          tenant_visible?: boolean
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          unit_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      electricity_purchases: {
        Row: {
          created_at: string
          debt_recovered: number
          delivered_at: string | null
          delivery_channel: Database["public"]["Enums"]["channel"] | null
          failure_reason: string | null
          gross_amount: number
          id: string
          issued_at: string | null
          meter_id: string
          org_id: string
          payment_id: string | null
          profile_id: string
          rate_per_kwh: number | null
          receipt_sent_at: string | null
          reference: string
          service_fee: number
          status: string
          tariff_id: string | null
          token: string | null
          token_type: string | null
          unit_id: string
          units_kwh: number | null
          updated_at: string
          vat_amount: number
          vendor_id: string | null
          vendor_reference: string | null
        }
        Insert: {
          created_at?: string
          debt_recovered?: number
          delivered_at?: string | null
          delivery_channel?: Database["public"]["Enums"]["channel"] | null
          failure_reason?: string | null
          gross_amount: number
          id?: string
          issued_at?: string | null
          meter_id: string
          org_id: string
          payment_id?: string | null
          profile_id: string
          rate_per_kwh?: number | null
          receipt_sent_at?: string | null
          reference: string
          service_fee?: number
          status?: string
          tariff_id?: string | null
          token?: string | null
          token_type?: string | null
          unit_id: string
          units_kwh?: number | null
          updated_at?: string
          vat_amount?: number
          vendor_id?: string | null
          vendor_reference?: string | null
        }
        Update: {
          created_at?: string
          debt_recovered?: number
          delivered_at?: string | null
          delivery_channel?: Database["public"]["Enums"]["channel"] | null
          failure_reason?: string | null
          gross_amount?: number
          id?: string
          issued_at?: string | null
          meter_id?: string
          org_id?: string
          payment_id?: string | null
          profile_id?: string
          rate_per_kwh?: number | null
          receipt_sent_at?: string | null
          reference?: string
          service_fee?: number
          status?: string
          tariff_id?: string | null
          token?: string | null
          token_type?: string | null
          unit_id?: string
          units_kwh?: number | null
          updated_at?: string
          vat_amount?: number
          vendor_id?: string | null
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electricity_purchases_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_purchases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_purchases_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_purchases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_purchases_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_purchases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_purchases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "token_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          booking_fee: number
          capacity: number | null
          closes_at: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          max_booking_minutes: number
          name: string
          opens_at: string
          org_id: string
          property_id: string
          requires_booking: boolean
          requires_good_standing: boolean
          requires_induction: boolean
        }
        Insert: {
          booking_fee?: number
          capacity?: number | null
          closes_at?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_booking_minutes?: number
          name: string
          opens_at?: string
          org_id: string
          property_id: string
          requires_booking?: boolean
          requires_good_standing?: boolean
          requires_induction?: boolean
        }
        Update: {
          booking_fee?: number
          capacity?: number | null
          closes_at?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_booking_minutes?: number
          name?: string
          opens_at?: string
          org_id?: string
          property_id?: string
          requires_booking?: boolean
          requires_good_standing?: boolean
          requires_induction?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "facilities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_access_events: {
        Row: {
          facility_id: string
          grant_id: string | null
          id: string
          occurred_at: string
          org_id: string
          profile_id: string | null
          result: string
        }
        Insert: {
          facility_id: string
          grant_id?: string | null
          id?: string
          occurred_at?: string
          org_id: string
          profile_id?: string | null
          result?: string
        }
        Update: {
          facility_id?: string
          grant_id?: string | null
          id?: string
          occurred_at?: string
          org_id?: string
          profile_id?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_access_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_access_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "facility_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_access_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_access_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_access_grants: {
        Row: {
          access_tag: string | null
          created_at: string
          facility_id: string
          id: string
          induction_completed_at: string | null
          lease_id: string | null
          org_id: string
          profile_id: string
          status: string
          suspended_reason: string | null
          valid_from: string
          valid_until: string | null
          waiver_signed_at: string | null
        }
        Insert: {
          access_tag?: string | null
          created_at?: string
          facility_id: string
          id?: string
          induction_completed_at?: string | null
          lease_id?: string | null
          org_id: string
          profile_id: string
          status?: string
          suspended_reason?: string | null
          valid_from?: string
          valid_until?: string | null
          waiver_signed_at?: string | null
        }
        Update: {
          access_tag?: string | null
          created_at?: string
          facility_id?: string
          id?: string
          induction_completed_at?: string | null
          lease_id?: string | null
          org_id?: string
          profile_id?: string
          status?: string
          suspended_reason?: string | null
          valid_from?: string
          valid_until?: string | null
          waiver_signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_access_grants_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_access_grants_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_access_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_access_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_bookings: {
        Row: {
          cancelled_at: string | null
          created_at: string
          ends_at: string
          facility_id: string
          fee_amount: number
          guest_count: number
          id: string
          notes: string | null
          org_id: string
          payment_id: string | null
          profile_id: string
          starts_at: string
          status: Database["public"]["Enums"]["facility_booking_status"]
          unit_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          ends_at: string
          facility_id: string
          fee_amount?: number
          guest_count?: number
          id?: string
          notes?: string | null
          org_id: string
          payment_id?: string | null
          profile_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["facility_booking_status"]
          unit_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string
          facility_id?: string
          fee_amount?: number
          guest_count?: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_id?: string | null
          profile_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["facility_booking_status"]
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          credential_ref: string | null
          id: string
          is_sandbox: boolean
          kind: Database["public"]["Enums"]["integration_kind"]
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          name: string
          org_id: string | null
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credential_ref?: string | null
          id?: string
          is_sandbox?: boolean
          kind: Database["public"]["Enums"]["integration_kind"]
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          name: string
          org_id?: string | null
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credential_ref?: string | null
          id?: string
          is_sandbox?: boolean
          kind?: Database["public"]["Enums"]["integration_kind"]
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          name?: string
          org_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          channel: Database["public"]["Enums"]["charge_type"]
          created_at: string
          description: string
          id: string
          invoice_id: string
          meter_id: string | null
          net_amount: number
          quantity: number
          reading_from: number | null
          reading_to: number | null
          sequence: number
          total_amount: number
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          channel: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          meter_id?: string | null
          net_amount?: number
          quantity?: number
          reading_from?: number | null
          reading_to?: number | null
          sequence?: number
          total_amount?: number
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          channel?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          meter_id?: string | null
          net_amount?: number
          quantity?: number
          reading_from?: number | null
          reading_to?: number | null
          sequence?: number
          total_amount?: number
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          amount_due: number | null
          amount_paid: number
          billing_run_id: string | null
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          lease_id: string
          notes: string | null
          org_id: string
          paid_at: string | null
          pdf_path: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          unit_id: string
          updated_at: string
          vat_total: number
        }
        Insert: {
          account_id: string
          amount_due?: number | null
          amount_paid?: number
          billing_run_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          lease_id: string
          notes?: string | null
          org_id: string
          paid_at?: string | null
          pdf_path?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          unit_id: string
          updated_at?: string
          vat_total?: number
        }
        Update: {
          account_id?: string
          amount_due?: number | null
          amount_paid?: number
          billing_run_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          lease_id?: string
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          unit_id?: string
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_billing_run_id_fkey"
            columns: ["billing_run_id"]
            isOneToOne: false
            referencedRelation: "billing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_charges: {
        Row: {
          amount: number
          created_at: string
          description: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["charge_frequency"]
          id: string
          is_active: boolean
          is_metered: boolean
          lease_id: string
          org_id: string
          start_date: string
          type: Database["public"]["Enums"]["charge_type"]
          vat_rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["charge_frequency"]
          id?: string
          is_active?: boolean
          is_metered?: boolean
          lease_id: string
          org_id: string
          start_date?: string
          type: Database["public"]["Enums"]["charge_type"]
          vat_rate?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["charge_frequency"]
          id?: string
          is_active?: boolean
          is_metered?: boolean
          lease_id?: string
          org_id?: string
          start_date?: string
          type?: Database["public"]["Enums"]["charge_type"]
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "lease_charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_tenants: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          lease_id: string
          liability_percent: number
          moved_in_at: string | null
          moved_out_at: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          lease_id: string
          liability_percent?: number
          moved_in_at?: string | null
          moved_out_at?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          lease_id?: string
          liability_percent?: number
          moved_in_at?: string | null
          moved_out_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_tenants_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_tenants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          billing_day: number
          created_at: string
          deposit_amount: number
          deposit_held: number
          due_day: number
          end_date: string | null
          escalation_month: number | null
          escalation_percent: number
          grace_days: number
          id: string
          interest_rate_annual: number
          monthly_levy: number
          monthly_rent: number
          notes: string | null
          org_id: string
          reference: string
          signed_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          terminated_at: string | null
          termination_reason: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          billing_day?: number
          created_at?: string
          deposit_amount?: number
          deposit_held?: number
          due_day?: number
          end_date?: string | null
          escalation_month?: number | null
          escalation_percent?: number
          grace_days?: number
          id?: string
          interest_rate_annual?: number
          monthly_levy?: number
          monthly_rent: number
          notes?: string | null
          org_id: string
          reference: string
          signed_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          terminated_at?: string | null
          termination_reason?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          billing_day?: number
          created_at?: string
          deposit_amount?: number
          deposit_held?: number
          due_day?: number
          end_date?: string | null
          escalation_month?: number | null
          escalation_percent?: number
          grace_days?: number
          id?: string
          interest_rate_annual?: number
          monthly_levy?: number
          monthly_rent?: number
          notes?: string | null
          org_id?: string
          reference?: string
          signed_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          terminated_at?: string | null
          termination_reason?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          balance_after: number | null
          channel: Database["public"]["Enums"]["charge_type"]
          created_at: string
          description: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          invoice_id: string | null
          metadata: Json
          occurred_at: string
          org_id: string
          payment_id: string | null
          reference: string | null
        }
        Insert: {
          account_id: string
          amount: number
          balance_after?: number | null
          channel: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          description: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          invoice_id?: string | null
          metadata?: Json
          occurred_at?: string
          org_id: string
          payment_id?: string | null
          reference?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number | null
          channel?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          description?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          invoice_id?: string | null
          metadata?: Json
          occurred_at?: string
          org_id?: string
          payment_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_invoice_fk"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_fk"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_comments: {
        Row: {
          attachment_urls: string[]
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          request_id: string
        }
        Insert: {
          attachment_urls?: string[]
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          request_id: string
        }
        Update: {
          attachment_urls?: string[]
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          access_instructions: string | null
          acknowledged_at: string | null
          actual_cost: number | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          contractor_id: string | null
          created_at: string
          description: string
          estimated_cost: number | null
          id: string
          is_tenant_liable: boolean
          lease_id: string | null
          location_detail: string | null
          org_id: string
          permission_to_enter: boolean
          photo_urls: string[]
          priority: Database["public"]["Enums"]["maintenance_priority"]
          property_id: string
          recharged_invoice_id: string | null
          reference: string
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_rating: number | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          acknowledged_at?: string | null
          actual_cost?: number | null
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          contractor_id?: string | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          id?: string
          is_tenant_liable?: boolean
          lease_id?: string | null
          location_detail?: string | null
          org_id: string
          permission_to_enter?: boolean
          photo_urls?: string[]
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          property_id: string
          recharged_invoice_id?: string | null
          reference: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          satisfaction_rating?: number | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          acknowledged_at?: string | null
          actual_cost?: number | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          contractor_id?: string | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          id?: string
          is_tenant_liable?: boolean
          lease_id?: string | null
          location_detail?: string | null
          org_id?: string
          permission_to_enter?: boolean
          photo_urls?: string[]
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          property_id?: string
          recharged_invoice_id?: string | null
          reference?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          satisfaction_rating?: number | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_recharged_invoice_id_fkey"
            columns: ["recharged_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["maintenance_status"] | null
          id: string
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["maintenance_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["maintenance_status"] | null
          id?: string
          note?: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["maintenance_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["maintenance_status"] | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["maintenance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_events: {
        Row: {
          event_type: string
          from_status: Database["public"]["Enums"]["mandate_status"] | null
          id: string
          mandate_id: string
          occurred_at: string
          payload: Json
          to_status: Database["public"]["Enums"]["mandate_status"] | null
        }
        Insert: {
          event_type: string
          from_status?: Database["public"]["Enums"]["mandate_status"] | null
          id?: string
          mandate_id: string
          occurred_at?: string
          payload?: Json
          to_status?: Database["public"]["Enums"]["mandate_status"] | null
        }
        Update: {
          event_type?: string
          from_status?: Database["public"]["Enums"]["mandate_status"] | null
          id?: string
          mandate_id?: string
          occurred_at?: string
          payload?: Json
          to_status?: Database["public"]["Enums"]["mandate_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "mandate_events_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "debicheck_mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          account_id: string | null
          body_preview: string | null
          campaign_id: string | null
          channel: Database["public"]["Enums"]["channel"]
          clicked_at: string | null
          cost: number | null
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          invoice_id: string | null
          opened_at: string | null
          org_id: string
          paid_at: string | null
          payment_id: string | null
          profile_id: string | null
          provider: string | null
          provider_message_id: string | null
          queued_at: string
          resulted_in_payment_id: string | null
          segments: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          subject: string | null
          template_key: string | null
          to_address: string
        }
        Insert: {
          account_id?: string | null
          body_preview?: string | null
          campaign_id?: string | null
          channel: Database["public"]["Enums"]["channel"]
          clicked_at?: string | null
          cost?: number | null
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          opened_at?: string | null
          org_id: string
          paid_at?: string | null
          payment_id?: string | null
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string
          resulted_in_payment_id?: string | null
          segments?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          subject?: string | null
          template_key?: string | null
          to_address: string
        }
        Update: {
          account_id?: string | null
          body_preview?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          clicked_at?: string | null
          cost?: number | null
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          opened_at?: string | null
          org_id?: string
          paid_at?: string | null
          payment_id?: string | null
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string
          resulted_in_payment_id?: string | null
          segments?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          subject?: string | null
          template_key?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_resulted_in_payment_id_fkey"
            columns: ["resulted_in_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["channel"]
          created_at: string
          id: string
          is_active: boolean
          is_transactional: boolean
          key: string
          name: string
          org_id: string
          subject: string | null
          updated_at: string
          use_letterhead: boolean
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_transactional?: boolean
          key: string
          name: string
          org_id: string
          subject?: string | null
          updated_at?: string
          use_letterhead?: boolean
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_transactional?: boolean
          key?: string
          name?: string
          org_id?: string
          subject?: string | null
          updated_at?: string
          use_letterhead?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          consumption: number | null
          created_at: string
          id: string
          is_estimate: boolean
          meter_id: string
          notes: string | null
          org_id: string
          photo_url: string | null
          read_at: string
          read_by: string | null
          reading: number
          source: Database["public"]["Enums"]["reading_source"]
        }
        Insert: {
          consumption?: number | null
          created_at?: string
          id?: string
          is_estimate?: boolean
          meter_id: string
          notes?: string | null
          org_id: string
          photo_url?: string | null
          read_at?: string
          read_by?: string | null
          reading: number
          source?: Database["public"]["Enums"]["reading_source"]
        }
        Update: {
          consumption?: number | null
          created_at?: string
          id?: string
          is_estimate?: boolean
          meter_id?: string
          notes?: string | null
          org_id?: string
          photo_url?: string | null
          read_at?: string
          read_by?: string | null
          reading?: number
          source?: Database["public"]["Enums"]["reading_source"]
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meters: {
        Row: {
          created_at: string
          id: string
          installed_on: string | null
          is_active: boolean
          is_bulk: boolean
          last_reading: number | null
          last_reading_at: string | null
          meter_number: string
          multiplier: number
          org_id: string
          property_id: string
          serial_number: string | null
          tariff_id: string | null
          type: Database["public"]["Enums"]["meter_type"]
          unit_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          installed_on?: string | null
          is_active?: boolean
          is_bulk?: boolean
          last_reading?: number | null
          last_reading_at?: string | null
          meter_number: string
          multiplier?: number
          org_id: string
          property_id: string
          serial_number?: string | null
          tariff_id?: string | null
          type: Database["public"]["Enums"]["meter_type"]
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          installed_on?: string | null
          is_active?: boolean
          is_bulk?: boolean
          last_reading?: number | null
          last_reading_at?: string | null
          meter_number?: string
          multiplier?: number
          org_id?: string
          property_id?: string
          serial_number?: string | null
          tariff_id?: string | null
          type?: Database["public"]["Enums"]["meter_type"]
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      org_branding: {
        Row: {
          accent_color: string
          base_font_size_px: number
          email_footer_html: string | null
          email_header_html: string | null
          favicon_url: string | null
          font_family: string
          letterhead_html: string | null
          logo_dark_url: string | null
          logo_url: string | null
          org_id: string
          portal_domain: string | null
          postal_address: string | null
          primary_color: string
          statement_footer: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          base_font_size_px?: number
          email_footer_html?: string | null
          email_header_html?: string | null
          favicon_url?: string | null
          font_family?: string
          letterhead_html?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          org_id: string
          portal_domain?: string | null
          postal_address?: string | null
          primary_color?: string
          statement_footer?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          base_font_size_px?: number
          email_footer_html?: string | null
          email_header_html?: string | null
          favicon_url?: string | null
          font_family?: string
          letterhead_html?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          org_id?: string
          portal_domain?: string | null
          postal_address?: string | null
          primary_color?: string
          statement_footer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          job_title: string | null
          org_id: string
          profile_id: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          job_title?: string | null
          org_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          job_title?: string | null
          org_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "org_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_email: string | null
          city: string | null
          country_code: string
          created_at: string
          currency_code: string
          id: string
          is_active: boolean
          name: string
          postal_code: string | null
          province: string | null
          registration_no: string | null
          slug: string
          support_email: string | null
          support_phone: string | null
          timezone: string
          trading_name: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          currency_code?: string
          id?: string
          is_active?: boolean
          name: string
          postal_code?: string | null
          province?: string | null
          registration_no?: string | null
          slug: string
          support_email?: string | null
          support_phone?: string | null
          timezone?: string
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          currency_code?: string
          id?: string
          is_active?: boolean
          name?: string
          postal_code?: string | null
          province?: string | null
          registration_no?: string | null
          slug?: string
          support_email?: string | null
          support_phone?: string | null
          timezone?: string
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          channel: Database["public"]["Enums"]["charge_type"]
          created_at: string
          id: string
          invoice_id: string | null
          payment_id: string
        }
        Insert: {
          amount: number
          channel: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id: string
        }
        Update: {
          amount?: number
          channel?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_last4: string | null
          bank_name: string | null
          brand: string | null
          created_at: string
          expiry_month: number | null
          expiry_year: number | null
          gateway: string
          gateway_token: string
          holder_name: string | null
          id: string
          is_active: boolean
          is_default: boolean
          last4: string | null
          method: Database["public"]["Enums"]["payment_method"]
          profile_id: string
        }
        Insert: {
          account_last4?: string | null
          bank_name?: string | null
          brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          gateway: string
          gateway_token: string
          holder_name?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          last4?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          profile_id: string
        }
        Update: {
          account_last4?: string | null
          bank_name?: string | null
          brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          gateway?: string
          gateway_token?: string
          holder_name?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          last4?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_instalments: {
        Row: {
          amount: number
          amount_paid: number
          due_date: string
          id: string
          paid_at: string | null
          payment_id: string | null
          plan_id: string
          sequence: number
          status: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          due_date: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          plan_id: string
          sequence: number
          status?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          due_date?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          plan_id?: string
          sequence?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_instalments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_instalments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          account_id: string
          amount_paid: number
          arrears_amount: number
          completed_at: string | null
          created_at: string
          defaulted_at: string | null
          deposit_amount: number
          first_due_date: string
          frequency: Database["public"]["Enums"]["charge_frequency"]
          id: string
          includes_current_charges: boolean
          instalment_amount: number
          instalment_count: number
          notes: string | null
          org_id: string
          proposed_by: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_plan_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id: string
          amount_paid?: number
          arrears_amount: number
          completed_at?: string | null
          created_at?: string
          defaulted_at?: string | null
          deposit_amount?: number
          first_due_date: string
          frequency?: Database["public"]["Enums"]["charge_frequency"]
          id?: string
          includes_current_charges?: boolean
          instalment_amount: number
          instalment_count: number
          notes?: string | null
          org_id: string
          proposed_by?: string | null
          reference: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id?: string
          amount_paid?: number
          arrears_amount?: number
          completed_at?: string | null
          created_at?: string
          defaulted_at?: string | null
          deposit_amount?: number
          first_due_date?: string
          frequency?: Database["public"]["Enums"]["charge_frequency"]
          id?: string
          includes_current_charges?: boolean
          instalment_amount?: number
          instalment_count?: number
          notes?: string | null
          org_id?: string
          proposed_by?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          approval_id: string | null
          authorised_at: string | null
          captured_at: string | null
          created_at: string
          currency_code: string
          failure_code: string | null
          failure_reason: string | null
          gateway: string | null
          gateway_reference: string | null
          id: string
          intent_channel: Database["public"]["Enums"]["charge_type"] | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          payment_method_id: string | null
          profile_id: string | null
          receipt_sent_at: string | null
          reference: string
          requires_approval: boolean
          reversed_at: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          three_ds_completed_at: string | null
          three_ds_redirect_url: string | null
          three_ds_required: boolean
          three_ds_status: string | null
          three_ds_version: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          approval_id?: string | null
          authorised_at?: string | null
          captured_at?: string | null
          created_at?: string
          currency_code?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway?: string | null
          gateway_reference?: string | null
          id?: string
          intent_channel?: Database["public"]["Enums"]["charge_type"] | null
          metadata?: Json
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          payment_method_id?: string | null
          profile_id?: string | null
          receipt_sent_at?: string | null
          reference: string
          requires_approval?: boolean
          reversed_at?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          three_ds_completed_at?: string | null
          three_ds_redirect_url?: string | null
          three_ds_required?: boolean
          three_ds_status?: string | null
          three_ds_version?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          approval_id?: string | null
          authorised_at?: string | null
          captured_at?: string | null
          created_at?: string
          currency_code?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway?: string | null
          gateway_reference?: string | null
          id?: string
          intent_channel?: Database["public"]["Enums"]["charge_type"] | null
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"]
          org_id?: string
          payment_method_id?: string | null
          profile_id?: string | null
          receipt_sent_at?: string | null
          reference?: string
          requires_approval?: boolean
          reversed_at?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          three_ds_completed_at?: string | null
          three_ds_redirect_url?: string | null
          three_ds_required?: boolean
          three_ds_status?: string | null
          three_ds_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_approval_fk"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alt_phone: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          id: string
          id_number: string | null
          id_type: string | null
          is_system_admin: boolean
          last_seen_at: string | null
          marketing_opt_in: boolean
          notify_email: boolean
          notify_sms: boolean
          phone: string | null
          postal_address: string | null
          preferred_name: string | null
          updated_at: string
        }
        Insert: {
          alt_phone?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          id: string
          id_number?: string | null
          id_type?: string | null
          is_system_admin?: boolean
          last_seen_at?: string | null
          marketing_opt_in?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          phone?: string | null
          postal_address?: string | null
          preferred_name?: string | null
          updated_at?: string
        }
        Update: {
          alt_phone?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          is_system_admin?: boolean
          last_seen_at?: string | null
          marketing_opt_in?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          phone?: string | null
          postal_address?: string | null
          preferred_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_id: string | null
          city: string | null
          code: string | null
          created_at: string
          gate_count: number
          has_gym: boolean
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          org_id: string
          postal_code: string | null
          province: string | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_id?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          gate_count?: number
          has_gym?: boolean
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          org_id: string
          postal_code?: string | null
          province?: string | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_id?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          gate_count?: number
          has_gym?: boolean
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          org_id?: string
          postal_code?: string | null
          province?: string | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_bank_account_fk"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          checked_at: string
          component: string
          detail: string | null
          id: number
          latency_ms: number | null
          status: Database["public"]["Enums"]["integration_status"]
        }
        Insert: {
          checked_at?: string
          component: string
          detail?: string | null
          id?: number
          latency_ms?: number | null
          status: Database["public"]["Enums"]["integration_status"]
        }
        Update: {
          checked_at?: string
          component?: string
          detail?: string | null
          id?: number
          latency_ms?: number | null
          status?: Database["public"]["Enums"]["integration_status"]
        }
        Relationships: []
      }
      tariff_blocks: {
        Row: {
          block_from_units: number
          block_to_units: number | null
          id: string
          rate_per_unit: number
          sequence: number
          tariff_id: string
        }
        Insert: {
          block_from_units?: number
          block_to_units?: number | null
          id?: string
          rate_per_unit: number
          sequence: number
          tariff_id: string
        }
        Update: {
          block_from_units?: number
          block_to_units?: number | null
          id?: string
          rate_per_unit?: number
          sequence?: number
          tariff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_blocks_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          fixed_charge: number
          id: string
          is_active: boolean
          markup_percent: number
          name: string
          org_id: string
          utility: Database["public"]["Enums"]["meter_type"]
          vat_rate: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fixed_charge?: number
          id?: string
          is_active?: boolean
          markup_percent?: number
          name: string
          org_id: string
          utility: Database["public"]["Enums"]["meter_type"]
          vat_rate?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fixed_charge?: number
          id?: string
          is_active?: boolean
          markup_percent?: number
          name?: string
          org_id?: string
          utility?: Database["public"]["Enums"]["meter_type"]
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tariffs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_accounts: {
        Row: {
          account_number: string
          balance: number
          created_at: string
          current_due: number
          id: string
          is_in_arrears: boolean
          is_on_payment_plan: boolean
          last_payment_amount: number | null
          last_payment_at: string | null
          lease_id: string
          org_id: string
          overdue_120_plus: number
          overdue_30: number
          overdue_60: number
          overdue_90: number
          updated_at: string
        }
        Insert: {
          account_number: string
          balance?: number
          created_at?: string
          current_due?: number
          id?: string
          is_in_arrears?: boolean
          is_on_payment_plan?: boolean
          last_payment_amount?: number | null
          last_payment_at?: string | null
          lease_id: string
          org_id: string
          overdue_120_plus?: number
          overdue_30?: number
          overdue_60?: number
          overdue_90?: number
          updated_at?: string
        }
        Update: {
          account_number?: string
          balance?: number
          created_at?: string
          current_due?: number
          id?: string
          is_in_arrears?: boolean
          is_on_payment_plan?: boolean
          last_payment_amount?: number | null
          last_payment_at?: string | null
          lease_id?: string
          org_id?: string
          overdue_120_plus?: number
          overdue_30?: number
          overdue_60?: number
          overdue_90?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_accounts_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: true
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_scores: {
        Row: {
          account_id: string | null
          average_days_late: number
          band: string
          bureau_checked_at: string | null
          bureau_score: number | null
          computed_at: string
          current_arrears: number
          failed_collections: number
          id: string
          late_payments: number
          missed_payments: number
          months_tenancy: number
          on_time_payments: number
          org_id: string
          profile_id: string
          score: number
        }
        Insert: {
          account_id?: string | null
          average_days_late?: number
          band: string
          bureau_checked_at?: string | null
          bureau_score?: number | null
          computed_at?: string
          current_arrears?: number
          failed_collections?: number
          id?: string
          late_payments?: number
          missed_payments?: number
          months_tenancy?: number
          on_time_payments?: number
          org_id: string
          profile_id: string
          score: number
        }
        Update: {
          account_id?: string | null
          average_days_late?: number
          band?: string
          bureau_checked_at?: string | null
          bureau_score?: number | null
          computed_at?: string
          current_arrears?: number
          failed_collections?: number
          id?: string
          late_payments?: number
          missed_payments?: number
          months_tenancy?: number
          on_time_payments?: number
          org_id?: string
          profile_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_scores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      token_vendors: {
        Row: {
          config: Json
          created_at: string
          credential_ref: string | null
          id: string
          is_active: boolean
          is_default: boolean
          key: string
          name: string
          org_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          credential_ref?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          key: string
          name: string
          org_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          credential_ref?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          key?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_applications: {
        Row: {
          affordability_ratio: number | null
          applicant_id: string
          approval_id: string | null
          company_name: string | null
          company_reg_no: string | null
          created_at: string
          created_lease_id: string | null
          credit_check_status: string | null
          credit_score: number | null
          decision_reason: string | null
          desired_move_in: string | null
          employer: string | null
          employment_type: string | null
          has_pets: boolean
          id: string
          is_company: boolean
          lease_term_months: number | null
          monthly_income: number | null
          motivation: string | null
          occupants: number | null
          org_id: string
          pet_detail: string | null
          property_id: string | null
          reference: string
          requested_type: Database["public"]["Enums"]["unit_type"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          trading_type: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          affordability_ratio?: number | null
          applicant_id: string
          approval_id?: string | null
          company_name?: string | null
          company_reg_no?: string | null
          created_at?: string
          created_lease_id?: string | null
          credit_check_status?: string | null
          credit_score?: number | null
          decision_reason?: string | null
          desired_move_in?: string | null
          employer?: string | null
          employment_type?: string | null
          has_pets?: boolean
          id?: string
          is_company?: boolean
          lease_term_months?: number | null
          monthly_income?: number | null
          motivation?: string | null
          occupants?: number | null
          org_id: string
          pet_detail?: string | null
          property_id?: string | null
          reference: string
          requested_type?: Database["public"]["Enums"]["unit_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          trading_type?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          affordability_ratio?: number | null
          applicant_id?: string
          approval_id?: string | null
          company_name?: string | null
          company_reg_no?: string | null
          created_at?: string
          created_lease_id?: string | null
          credit_check_status?: string | null
          credit_score?: number | null
          decision_reason?: string | null
          desired_move_in?: string | null
          employer?: string | null
          employment_type?: string | null
          has_pets?: boolean
          id?: string
          is_company?: boolean
          lease_term_months?: number | null
          monthly_income?: number | null
          motivation?: string | null
          occupants?: number | null
          org_id?: string
          pet_detail?: string | null
          property_id?: string | null
          reference?: string
          requested_type?: Database["public"]["Enums"]["unit_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          trading_type?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_applications_approval_fk"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_applications_created_lease_id_fkey"
            columns: ["created_lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_applications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          base_rent: number
          bathrooms: number | null
          bedrooms: number | null
          block: string | null
          created_at: string
          deposit_amount: number
          electricity_tariff_id: string | null
          floor: string | null
          id: string
          levy_amount: number
          notes: string | null
          org_id: string
          parking_bays: number
          property_id: string
          refuse_amount: number
          security_amount: number
          size_sqm: number | null
          status: Database["public"]["Enums"]["unit_status"]
          type: Database["public"]["Enums"]["unit_type"]
          unit_number: string
          updated_at: string
          water_tariff_id: string | null
        }
        Insert: {
          base_rent?: number
          bathrooms?: number | null
          bedrooms?: number | null
          block?: string | null
          created_at?: string
          deposit_amount?: number
          electricity_tariff_id?: string | null
          floor?: string | null
          id?: string
          levy_amount?: number
          notes?: string | null
          org_id: string
          parking_bays?: number
          property_id: string
          refuse_amount?: number
          security_amount?: number
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["unit_status"]
          type?: Database["public"]["Enums"]["unit_type"]
          unit_number: string
          updated_at?: string
          water_tariff_id?: string | null
        }
        Update: {
          base_rent?: number
          bathrooms?: number | null
          bedrooms?: number | null
          block?: string | null
          created_at?: string
          deposit_amount?: number
          electricity_tariff_id?: string | null
          floor?: string | null
          id?: string
          levy_amount?: number
          notes?: string | null
          org_id?: string
          parking_bays?: number
          property_id?: string
          refuse_amount?: number
          security_amount?: number
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["unit_status"]
          type?: Database["public"]["Enums"]["unit_type"]
          unit_number?: string
          updated_at?: string
          water_tariff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_electricity_tariff_fk"
            columns: ["electricity_tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_water_tariff_fk"
            columns: ["water_tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          detail: string | null
          deviation_percent: number | null
          expected_value: number | null
          id: string
          is_acknowledged: boolean
          maintenance_request_id: string | null
          meter_id: string | null
          observed_value: number | null
          org_id: string
          period_end: string | null
          period_start: string | null
          resolved_at: string | null
          rule: string
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          unit_id: string
          utility: Database["public"]["Enums"]["meter_type"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          detail?: string | null
          deviation_percent?: number | null
          expected_value?: number | null
          id?: string
          is_acknowledged?: boolean
          maintenance_request_id?: string | null
          meter_id?: string | null
          observed_value?: number | null
          org_id: string
          period_end?: string | null
          period_start?: string | null
          resolved_at?: string | null
          rule: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          unit_id: string
          utility: Database["public"]["Enums"]["meter_type"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          detail?: string | null
          deviation_percent?: number | null
          expected_value?: number | null
          id?: string
          is_acknowledged?: boolean
          maintenance_request_id?: string | null
          meter_id?: string | null
          observed_value?: number | null
          org_id?: string
          period_end?: string | null
          period_start?: string | null
          resolved_at?: string | null
          rule?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          unit_id?: string
          utility?: Database["public"]["Enums"]["meter_type"]
        }
        Relationships: [
          {
            foreignKeyName: "usage_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_alerts_maintenance_fk"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_alerts_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_alerts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_baselines: {
        Row: {
          computed_at: string
          id: string
          mean_consumption: number
          meter_id: string
          org_id: string
          peak_consumption: number
          period_days: number
          sample_count: number
          stddev_consumption: number
          unit_id: string
          utility: Database["public"]["Enums"]["meter_type"]
        }
        Insert: {
          computed_at?: string
          id?: string
          mean_consumption?: number
          meter_id: string
          org_id: string
          peak_consumption?: number
          period_days?: number
          sample_count?: number
          stddev_consumption?: number
          unit_id: string
          utility: Database["public"]["Enums"]["meter_type"]
        }
        Update: {
          computed_at?: string
          id?: string
          mean_consumption?: number
          meter_id?: string
          org_id?: string
          peak_consumption?: number
          period_days?: number
          sample_count?: number
          stddev_consumption?: number
          unit_id?: string
          utility?: Database["public"]["Enums"]["meter_type"]
        }
        Relationships: [
          {
            foreignKeyName: "usage_baselines_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_baselines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_baselines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_rules: {
        Row: {
          absolute_threshold: number | null
          continuous_min: number | null
          created_at: string
          id: string
          is_active: boolean
          notify_staff: boolean
          notify_tenant: boolean
          org_id: string
          property_id: string | null
          rule: string
          severity: Database["public"]["Enums"]["alert_severity"]
          spike_percent: number | null
          utility: Database["public"]["Enums"]["meter_type"]
          window_hours: number | null
        }
        Insert: {
          absolute_threshold?: number | null
          continuous_min?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          notify_staff?: boolean
          notify_tenant?: boolean
          org_id: string
          property_id?: string | null
          rule: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          spike_percent?: number | null
          utility: Database["public"]["Enums"]["meter_type"]
          window_hours?: number | null
        }
        Update: {
          absolute_threshold?: number | null
          continuous_min?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          notify_staff?: boolean
          notify_tenant?: boolean
          org_id?: string
          property_id?: string | null
          rule?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          spike_percent?: number | null
          utility?: Database["public"]["Enums"]["meter_type"]
          window_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_type: string
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          received_at: string
          signature_valid: boolean | null
        }
        Insert: {
          event_type: string
          external_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          received_at?: string
          signature_valid?: boolean | null
        }
        Update: {
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
          signature_valid?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      vb_arrears_case_history: {
        Row: {
          actor: string | null
          caseId: string | null
          createdAt: string | null
          fromStage: string | null
          id: number | null
          note: string | null
          toStage: string | null
        }
        Insert: {
          actor?: string | null
          caseId?: string | null
          createdAt?: string | null
          fromStage?: string | null
          id?: number | null
          note?: string | null
          toStage?: string | null
        }
        Update: {
          actor?: string | null
          caseId?: string | null
          createdAt?: string | null
          fromStage?: string | null
          id?: number | null
          note?: string | null
          toStage?: string | null
        }
        Relationships: []
      }
      vb_arrears_cases: {
        Row: {
          assignedTo: string | null
          createdAt: string | null
          id: string | null
          invoiceId: string | null
          stage: string | null
          unitId: string | null
          updatedAt: string | null
        }
        Insert: {
          assignedTo?: string | null
          createdAt?: string | null
          id?: string | null
          invoiceId?: string | null
          stage?: string | null
          unitId?: string | null
          updatedAt?: string | null
        }
        Update: {
          assignedTo?: string | null
          createdAt?: string | null
          id?: string | null
          invoiceId?: string | null
          stage?: string | null
          unitId?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      vb_credit_notes: {
        Row: {
          amount: number | null
          createdAt: string | null
          id: string | null
          invoiceId: string | null
          issuedBy: string | null
          reason: string | null
        }
        Insert: {
          amount?: number | null
          createdAt?: string | null
          id?: string | null
          invoiceId?: string | null
          issuedBy?: string | null
          reason?: string | null
        }
        Update: {
          amount?: number | null
          createdAt?: string | null
          id?: string | null
          invoiceId?: string | null
          issuedBy?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      vb_disputes: {
        Row: {
          createdAt: string | null
          description: string | null
          id: string | null
          invoiceId: string | null
          reason: string | null
          resolutionNote: string | null
          resolvedAt: string | null
          status: string | null
          unitId: string | null
        }
        Insert: {
          createdAt?: string | null
          description?: string | null
          id?: string | null
          invoiceId?: string | null
          reason?: string | null
          resolutionNote?: string | null
          resolvedAt?: string | null
          status?: string | null
          unitId?: string | null
        }
        Update: {
          createdAt?: string | null
          description?: string | null
          id?: string | null
          invoiceId?: string | null
          reason?: string | null
          resolutionNote?: string | null
          resolvedAt?: string | null
          status?: string | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_dunning_log: {
        Row: {
          channel: string | null
          id: number | null
          invoiceId: string | null
          message: string | null
          sentAt: string | null
          unitId: string | null
        }
        Insert: {
          channel?: string | null
          id?: number | null
          invoiceId?: string | null
          message?: string | null
          sentAt?: string | null
          unitId?: string | null
        }
        Update: {
          channel?: string | null
          id?: number | null
          invoiceId?: string | null
          message?: string | null
          sentAt?: string | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_estate_manager_estates: {
        Row: {
          estateId: string | null
          userId: string | null
        }
        Insert: {
          estateId?: string | null
          userId?: string | null
        }
        Update: {
          estateId?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      vb_estates: {
        Row: {
          address: string | null
          contactEmail: string | null
          contactPhone: string | null
          createdAt: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          address?: string | null
          contactEmail?: string | null
          contactPhone?: string | null
          createdAt?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          address?: string | null
          contactEmail?: string | null
          contactPhone?: string | null
          createdAt?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      vb_event_log: {
        Row: {
          actor: string | null
          createdAt: string | null
          eventType: string | null
          id: number | null
          payload: Json | null
          source: string | null
        }
        Insert: {
          actor?: string | null
          createdAt?: string | null
          eventType?: string | null
          id?: number | null
          payload?: Json | null
          source?: string | null
        }
        Update: {
          actor?: string | null
          createdAt?: string | null
          eventType?: string | null
          id?: number | null
          payload?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      vb_invoice_lines: {
        Row: {
          amount: number | null
          category: string | null
          description: string | null
          id: number | null
          invoiceId: string | null
          quantity: number | null
          unitPrice: number | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          description?: string | null
          id?: number | null
          invoiceId?: string | null
          quantity?: number | null
          unitPrice?: number | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          description?: string | null
          id?: number | null
          invoiceId?: string | null
          quantity?: number | null
          unitPrice?: number | null
        }
        Relationships: []
      }
      vb_invoices: {
        Row: {
          amountPaid: number | null
          billingPeriod: string | null
          createdAt: string | null
          dueDate: string | null
          id: string | null
          issueDate: string | null
          leaseId: string | null
          status: string | null
          totalAmount: number | null
          unitId: string | null
        }
        Insert: {
          amountPaid?: number | null
          billingPeriod?: string | null
          createdAt?: string | null
          dueDate?: string | null
          id?: string | null
          issueDate?: string | null
          leaseId?: string | null
          status?: string | null
          totalAmount?: number | null
          unitId?: string | null
        }
        Update: {
          amountPaid?: number | null
          billingPeriod?: string | null
          createdAt?: string | null
          dueDate?: string | null
          id?: string | null
          issueDate?: string | null
          leaseId?: string | null
          status?: string | null
          totalAmount?: number | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_landlord_estates: {
        Row: {
          estateId: string | null
          userId: string | null
        }
        Insert: {
          estateId?: string | null
          userId?: string | null
        }
        Update: {
          estateId?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      vb_leases: {
        Row: {
          createdAt: string | null
          endDate: string | null
          id: string | null
          rentAmount: number | null
          startDate: string | null
          status: string | null
          tenantUserId: string | null
          unitId: string | null
        }
        Insert: {
          createdAt?: string | null
          endDate?: string | null
          id?: string | null
          rentAmount?: number | null
          startDate?: string | null
          status?: string | null
          tenantUserId?: string | null
          unitId?: string | null
        }
        Update: {
          createdAt?: string | null
          endDate?: string | null
          id?: string | null
          rentAmount?: number | null
          startDate?: string | null
          status?: string | null
          tenantUserId?: string | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_legal_escalations: {
        Row: {
          caseId: string | null
          createdAt: string | null
          id: string | null
          notes: string | null
          status: string | null
        }
        Insert: {
          caseId?: string | null
          createdAt?: string | null
          id?: string | null
          notes?: string | null
          status?: string | null
        }
        Update: {
          caseId?: string | null
          createdAt?: string | null
          id?: string | null
          notes?: string | null
          status?: string | null
        }
        Relationships: []
      }
      vb_loadshedding_schedules: {
        Row: {
          dayOfWeek: number | null
          endTime: string | null
          estateId: string | null
          id: number | null
          stage: number | null
          startTime: string | null
        }
        Insert: {
          dayOfWeek?: number | null
          endTime?: string | null
          estateId?: string | null
          id?: number | null
          stage?: number | null
          startTime?: string | null
        }
        Update: {
          dayOfWeek?: number | null
          endTime?: string | null
          estateId?: string | null
          id?: number | null
          stage?: number | null
          startTime?: string | null
        }
        Relationships: []
      }
      vb_meters: {
        Row: {
          id: string | null
          lastReading: number | null
          lastReadingAt: string | null
          serial: string | null
          status: string | null
          type: string | null
          unitId: string | null
        }
        Insert: {
          id?: string | null
          lastReading?: number | null
          lastReadingAt?: string | null
          serial?: string | null
          status?: string | null
          type?: string | null
          unitId?: string | null
        }
        Update: {
          id?: string | null
          lastReading?: number | null
          lastReadingAt?: string | null
          serial?: string | null
          status?: string | null
          type?: string | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_payment_plans: {
        Row: {
          createdAt: string | null
          id: string | null
          installmentAmount: number | null
          installments: number | null
          invoiceId: string | null
          startDate: string | null
          status: string | null
          totalAmount: number | null
          unitId: string | null
        }
        Insert: {
          createdAt?: string | null
          id?: string | null
          installmentAmount?: number | null
          installments?: number | null
          invoiceId?: string | null
          startDate?: string | null
          status?: string | null
          totalAmount?: number | null
          unitId?: string | null
        }
        Update: {
          createdAt?: string | null
          id?: string | null
          installmentAmount?: number | null
          installments?: number | null
          invoiceId?: string | null
          startDate?: string | null
          status?: string | null
          totalAmount?: number | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_payment_transactions: {
        Row: {
          amount: number | null
          createdAt: string | null
          erpStatus: string | null
          invoiceId: string | null
          method: string | null
          ref: string | null
          status: string | null
          unitId: string | null
        }
        Insert: {
          amount?: number | null
          createdAt?: string | null
          erpStatus?: string | null
          invoiceId?: string | null
          method?: string | null
          ref?: string | null
          status?: string | null
          unitId?: string | null
        }
        Update: {
          amount?: number | null
          createdAt?: string | null
          erpStatus?: string | null
          invoiceId?: string | null
          method?: string | null
          ref?: string | null
          status?: string | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_prepaid_tokens: {
        Row: {
          amount: number | null
          id: string | null
          meterId: string | null
          token: string | null
          unitId: string | null
          units: number | null
          vendedAt: string | null
        }
        Insert: {
          amount?: number | null
          id?: string | null
          meterId?: string | null
          token?: string | null
          unitId?: string | null
          units?: number | null
          vendedAt?: string | null
        }
        Update: {
          amount?: number | null
          id?: string | null
          meterId?: string | null
          token?: string | null
          unitId?: string | null
          units?: number | null
          vendedAt?: string | null
        }
        Relationships: []
      }
      vb_readings: {
        Row: {
          id: number | null
          meterId: string | null
          readAt: string | null
          reading: number | null
        }
        Insert: {
          id?: number | null
          meterId?: string | null
          readAt?: string | null
          reading?: number | null
        }
        Update: {
          id?: number | null
          meterId?: string | null
          readAt?: string | null
          reading?: number | null
        }
        Relationships: []
      }
      vb_statement_templates: {
        Row: {
          estateId: string | null
          htmlContent: string | null
          id: string | null
          name: string | null
          updatedAt: string | null
          updatedBy: string | null
        }
        Insert: {
          estateId?: string | null
          htmlContent?: string | null
          id?: string | null
          name?: string | null
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Update: {
          estateId?: string | null
          htmlContent?: string | null
          id?: string | null
          name?: string | null
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Relationships: []
      }
      vb_tariffs: {
        Row: {
          code: string | null
          description: string | null
          electricityPerKwh: number | null
          id: number | null
          validFrom: string | null
          validTo: string | null
          vatRate: number | null
          waterPerKl: number | null
        }
        Insert: {
          code?: string | null
          description?: string | null
          electricityPerKwh?: number | null
          id?: number | null
          validFrom?: string | null
          validTo?: string | null
          vatRate?: number | null
          waterPerKl?: number | null
        }
        Update: {
          code?: string | null
          description?: string | null
          electricityPerKwh?: number | null
          id?: number | null
          validFrom?: string | null
          validTo?: string | null
          vatRate?: number | null
          waterPerKl?: number | null
        }
        Relationships: []
      }
      vb_tenant_invites: {
        Row: {
          activatedAt: string | null
          createdAt: string | null
          email: string | null
          id: string | null
          invitedBy: string | null
          leaseId: string | null
          status: string | null
          token: string | null
          unitId: string | null
        }
        Insert: {
          activatedAt?: string | null
          createdAt?: string | null
          email?: string | null
          id?: string | null
          invitedBy?: string | null
          leaseId?: string | null
          status?: string | null
          token?: string | null
          unitId?: string | null
        }
        Update: {
          activatedAt?: string | null
          createdAt?: string | null
          email?: string | null
          id?: string | null
          invitedBy?: string | null
          leaseId?: string | null
          status?: string | null
          token?: string | null
          unitId?: string | null
        }
        Relationships: []
      }
      vb_units: {
        Row: {
          createdAt: string | null
          estateId: string | null
          id: string | null
          unitNumber: string | null
        }
        Insert: {
          createdAt?: string | null
          estateId?: string | null
          id?: string | null
          unitNumber?: string | null
        }
        Update: {
          createdAt?: string | null
          estateId?: string | null
          id?: string | null
          unitNumber?: string | null
        }
        Relationships: []
      }
      vb_users: {
        Row: {
          createdAt: string | null
          email: string | null
          id: string | null
          name: string | null
          role: string | null
          tenantUnitId: string | null
        }
        Insert: {
          createdAt?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          role?: string | null
          tenantUnitId?: string | null
        }
        Update: {
          createdAt?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          role?: string | null
          tenantUnitId?: string | null
        }
        Relationships: []
      }
      vb_webhook_deliveries: {
        Row: {
          attemptedAt: string | null
          endpointId: string | null
          error: string | null
          eventId: number | null
          id: number | null
          responseCode: number | null
          status: string | null
        }
        Insert: {
          attemptedAt?: string | null
          endpointId?: string | null
          error?: string | null
          eventId?: number | null
          id?: number | null
          responseCode?: number | null
          status?: string | null
        }
        Update: {
          attemptedAt?: string | null
          endpointId?: string | null
          error?: string | null
          eventId?: number | null
          id?: number | null
          responseCode?: number | null
          status?: string | null
        }
        Relationships: []
      }
      vb_webhook_endpoints: {
        Row: {
          active: boolean | null
          createdAt: string | null
          id: string | null
          name: string | null
          url: string | null
        }
        Insert: {
          active?: boolean | null
          createdAt?: string | null
          id?: string | null
          name?: string | null
          url?: string | null
        }
        Update: {
          active?: boolean | null
          createdAt?: string | null
          id?: string | null
          name?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _vb_append_event: {
        Args: { p_event_type: string; p_payload?: Json; p_source: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "event_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _vb_next_seq: {
        Args: { p_id_column?: string; p_schema: string; p_table: string }
        Returns: number
      }
      _vb_tariff_in_force: {
        Args: { p_code: string; p_on_date: string }
        Returns: Database["public"]["Tables"]["tariffs"]["Row"]
        SetofOptions: {
          from: "*"
          to: "tariffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_tariff_cost: {
        Args: { p_tariff: string; p_units: number }
        Returns: {
          net_amount: number
          total_amount: number
          vat_amount: number
        }[]
      }
      check_facility_access: {
        Args: { p_facility: string; p_profile: string }
        Returns: {
          allowed: boolean
          result: string
        }[]
      }
      compute_tenant_score: {
        Args: { p_org: string; p_profile: string }
        Returns: number
      }
      current_account_ids: { Args: never; Returns: string[] }
      current_lease_ids: { Args: never; Returns: string[] }
      current_org_ids: { Args: never; Returns: string[] }
      current_property_ids: { Args: never; Returns: string[] }
      current_unit_ids: { Args: never; Returns: string[] }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      has_org_access: { Args: { target_org: string }; Returns: boolean }
      has_org_role: {
        Args: {
          roles: Database["public"]["Enums"]["org_role"][]
          target_org: string
        }
        Returns: boolean
      }
      is_system_admin: { Args: never; Returns: boolean }
      next_sequence_number: {
        Args: { p_kind: string; p_org: string; p_prefix: string }
        Returns: string
      }
      redeem_access_code: {
        Args: {
          p_code: string
          p_direction?: string
          p_gate?: string
          p_property: string
        }
        Returns: {
          allowed: boolean
          code_id: string
          result: string
        }[]
      }
      refresh_account_ageing: { Args: { p_org: string }; Returns: undefined }
      refresh_usage_baseline: {
        Args: { p_days?: number; p_meter: string }
        Returns: undefined
      }
      run_billing: {
        Args: {
          p_due_date: string
          p_org: string
          p_period_end: string
          p_period_start: string
          p_property?: string
          p_run_by?: string
        }
        Returns: string
      }
      settle_payment: { Args: { p_payment: string }; Returns: undefined }
      units_for_amount: {
        Args: { p_amount: number; p_tariff: string }
        Returns: number
      }
      vb_complete_tenant_activation: {
        Args: { p_auth_user_id: string; p_name: string; p_token: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_create_dispute: {
        Args: { p_description: string; p_invoice_id: string; p_reason: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_create_payment_plan: {
        Args: {
          p_installments: number
          p_invoice_id: string
          p_start_date?: string
          p_total_amount: number
          p_unit_id: string
        }
        Returns: Database["public"]["Tables"]["payment_plans"]["Row"]
        SetofOptions: {
          from: "*"
          to: "payment_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_create_tariff: {
        Args: {
          p_code: string
          p_description: string
          p_electricity_per_kwh: number
          p_valid_from: string
          p_vat_rate: number
          p_water_per_kl: number
        }
        Returns: Database["public"]["Tables"]["tariffs"]["Row"]
        SetofOptions: {
          from: "*"
          to: "tariffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_escalate_to_legal: {
        Args: { p_case_id: string; p_notes?: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "legal_escalations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_flag_overdue_invoices: {
        Args: { p_estate_id: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "arrears_cases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      vb_ingest_meter_reading: {
        Args: { p_meter_id: string; p_read_at?: string; p_reading: number }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "readings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_invite_tenant: {
        Args: {
          p_email: string
          p_rent_amount: number
          p_start_date?: string
          p_unit_id: string
        }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "tenant_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_issue_credit_note: {
        Args: { p_amount: number; p_invoice_id: string; p_reason: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "credit_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_mock_bipra_pay_charge: {
        Args: { p_amount: number; p_invoice_id: string; p_method?: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_mock_morr_erp_post: {
        Args: { p_ref: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_mock_transfund_refund: {
        Args: { p_amount: number; p_reason: string; p_ref: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_move_arrears_case: {
        Args: { p_case_id: string; p_note?: string; p_to_stage: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "arrears_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_resolve_dispute: {
        Args: { p_id: string; p_resolution_note: string; p_status: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_run_billing_period: {
        Args: { p_billing_period?: string; p_estate_id: string }
        Returns: Database["public"]["Tables"]["invoices"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      vb_send_dunning_reminder: {
        Args: { p_channel: string; p_invoice_id: string; p_message: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "dunning_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vb_vend_prepaid_token: {
        Args: { p_amount: number; p_meter_id: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "prepaid_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      access_code_status: "active" | "used" | "expired" | "revoked"
      access_code_type:
        | "visitor"
        | "delivery"
        | "contractor"
        | "resident"
        | "once_off_event"
      alert_severity: "info" | "warning" | "critical"
      application_status:
        | "submitted"
        | "screening"
        | "documents_requested"
        | "approved"
        | "declined"
        | "withdrawn"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "expired"
      approval_type:
        | "large_payment"
        | "bank_account_change"
        | "user_deletion"
        | "unit_application"
        | "lease_termination"
        | "payment_plan"
        | "refund"
        | "write_off"
        | "bulk_campaign"
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "paused"
        | "cancelled"
      channel: "email" | "sms" | "push" | "whatsapp"
      charge_frequency: "once_off" | "monthly" | "quarterly" | "annually"
      charge_type:
        | "rent"
        | "levy"
        | "water"
        | "electricity"
        | "maintenance"
        | "refuse"
        | "security"
        | "parking"
        | "deposit"
        | "interest"
        | "penalty"
        | "admin_fee"
        | "reconnection"
        | "other"
      collection_status:
        | "scheduled"
        | "submitted"
        | "successful"
        | "failed"
        | "disputed"
        | "reversed"
      delivery_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
        | "unsubscribed"
      document_type:
        | "signed_lease"
        | "unsigned_lease"
        | "estate_policy"
        | "house_rules"
        | "id_copy"
        | "payslip"
        | "bank_statement"
        | "proof_of_address"
        | "invoice_pdf"
        | "statement_pdf"
        | "inspection_report"
        | "notice"
        | "other"
      facility_booking_status:
        | "requested"
        | "confirmed"
        | "cancelled"
        | "no_show"
        | "completed"
      integration_kind:
        | "payment_gateway"
        | "sms_gateway"
        | "email_gateway"
        | "meter_vendor"
        | "token_vendor"
        | "accounting"
        | "bank_feed"
        | "identity_verification"
      integration_status:
        | "not_configured"
        | "healthy"
        | "degraded"
        | "down"
        | "disabled"
      invoice_status:
        | "draft"
        | "issued"
        | "part_paid"
        | "paid"
        | "overdue"
        | "written_off"
        | "cancelled"
      lease_status:
        | "draft"
        | "pending_signature"
        | "active"
        | "expiring"
        | "expired"
        | "terminated"
        | "cancelled"
      ledger_direction: "debit" | "credit"
      maintenance_priority: "low" | "normal" | "high" | "emergency"
      maintenance_status:
        | "logged"
        | "acknowledged"
        | "assigned"
        | "in_progress"
        | "on_hold"
        | "resolved"
        | "closed"
        | "rejected"
      mandate_status:
        | "draft"
        | "pending_authentication"
        | "authenticated"
        | "active"
        | "suspended"
        | "cancelled"
        | "rejected"
        | "expired"
      meter_type:
        | "electricity_prepaid"
        | "electricity_conventional"
        | "water"
        | "gas"
        | "heat"
      org_role:
        | "owner"
        | "admin"
        | "manager"
        | "finance"
        | "maintenance"
        | "viewer"
      payment_method:
        | "card"
        | "eft"
        | "debit_order"
        | "debicheck"
        | "cash"
        | "instant_eft"
        | "wallet"
        | "adjustment"
      payment_plan_status:
        | "proposed"
        | "awaiting_acceptance"
        | "active"
        | "completed"
        | "defaulted"
        | "cancelled"
        | "requested"
      payment_status:
        | "initiated"
        | "requires_3ds"
        | "authorised"
        | "captured"
        | "settled"
        | "failed"
        | "reversed"
        | "refunded"
      property_type:
        | "residential_estate"
        | "apartment_block"
        | "office_park"
        | "retail_centre"
        | "mixed_use"
      reading_source:
        | "manual"
        | "ami_push"
        | "ami_poll"
        | "tenant_submitted"
        | "estimate"
      unit_status:
        | "available"
        | "occupied"
        | "reserved"
        | "maintenance"
        | "decommissioned"
      unit_type:
        | "apartment"
        | "house"
        | "townhouse"
        | "office"
        | "retail_store"
        | "storage"
        | "parking_bay"
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
      access_code_status: ["active", "used", "expired", "revoked"],
      access_code_type: [
        "visitor",
        "delivery",
        "contractor",
        "resident",
        "once_off_event",
      ],
      alert_severity: ["info", "warning", "critical"],
      application_status: [
        "submitted",
        "screening",
        "documents_requested",
        "approved",
        "declined",
        "withdrawn",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "expired",
      ],
      approval_type: [
        "large_payment",
        "bank_account_change",
        "user_deletion",
        "unit_application",
        "lease_termination",
        "payment_plan",
        "refund",
        "write_off",
        "bulk_campaign",
      ],
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "paused",
        "cancelled",
      ],
      channel: ["email", "sms", "push", "whatsapp"],
      charge_frequency: ["once_off", "monthly", "quarterly", "annually"],
      charge_type: [
        "rent",
        "levy",
        "water",
        "electricity",
        "maintenance",
        "refuse",
        "security",
        "parking",
        "deposit",
        "interest",
        "penalty",
        "admin_fee",
        "reconnection",
        "other",
      ],
      collection_status: [
        "scheduled",
        "submitted",
        "successful",
        "failed",
        "disputed",
        "reversed",
      ],
      delivery_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
        "unsubscribed",
      ],
      document_type: [
        "signed_lease",
        "unsigned_lease",
        "estate_policy",
        "house_rules",
        "id_copy",
        "payslip",
        "bank_statement",
        "proof_of_address",
        "invoice_pdf",
        "statement_pdf",
        "inspection_report",
        "notice",
        "other",
      ],
      facility_booking_status: [
        "requested",
        "confirmed",
        "cancelled",
        "no_show",
        "completed",
      ],
      integration_kind: [
        "payment_gateway",
        "sms_gateway",
        "email_gateway",
        "meter_vendor",
        "token_vendor",
        "accounting",
        "bank_feed",
        "identity_verification",
      ],
      integration_status: [
        "not_configured",
        "healthy",
        "degraded",
        "down",
        "disabled",
      ],
      invoice_status: [
        "draft",
        "issued",
        "part_paid",
        "paid",
        "overdue",
        "written_off",
        "cancelled",
      ],
      lease_status: [
        "draft",
        "pending_signature",
        "active",
        "expiring",
        "expired",
        "terminated",
        "cancelled",
      ],
      ledger_direction: ["debit", "credit"],
      maintenance_priority: ["low", "normal", "high", "emergency"],
      maintenance_status: [
        "logged",
        "acknowledged",
        "assigned",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
        "rejected",
      ],
      mandate_status: [
        "draft",
        "pending_authentication",
        "authenticated",
        "active",
        "suspended",
        "cancelled",
        "rejected",
        "expired",
      ],
      meter_type: [
        "electricity_prepaid",
        "electricity_conventional",
        "water",
        "gas",
        "heat",
      ],
      org_role: [
        "owner",
        "admin",
        "manager",
        "finance",
        "maintenance",
        "viewer",
      ],
      payment_method: [
        "card",
        "eft",
        "debit_order",
        "debicheck",
        "cash",
        "instant_eft",
        "wallet",
        "adjustment",
      ],
      payment_plan_status: [
        "proposed",
        "awaiting_acceptance",
        "active",
        "completed",
        "defaulted",
        "cancelled",
        "requested",
      ],
      payment_status: [
        "initiated",
        "requires_3ds",
        "authorised",
        "captured",
        "settled",
        "failed",
        "reversed",
        "refunded",
      ],
      property_type: [
        "residential_estate",
        "apartment_block",
        "office_park",
        "retail_centre",
        "mixed_use",
      ],
      reading_source: [
        "manual",
        "ami_push",
        "ami_poll",
        "tenant_submitted",
        "estimate",
      ],
      unit_status: [
        "available",
        "occupied",
        "reserved",
        "maintenance",
        "decommissioned",
      ],
      unit_type: [
        "apartment",
        "house",
        "townhouse",
        "office",
        "retail_store",
        "storage",
        "parking_bay",
      ],
    },
  },
} as const
