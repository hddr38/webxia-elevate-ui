export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_audit_log: {
        Row: {
          conversation_id: string | null;
          created_at: string;
          error_message: string | null;
          event_data: Json;
          event_type: Database["public"]["Enums"]["ai_audit_event_type"];
          id: string;
          ip_address: unknown;
          request_id: string | null;
          session_id: string | null;
          severity: Database["public"]["Enums"]["ai_audit_severity"];
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          conversation_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          event_data?: Json;
          event_type: Database["public"]["Enums"]["ai_audit_event_type"];
          id?: string;
          ip_address?: unknown;
          request_id?: string | null;
          session_id?: string | null;
          severity?: Database["public"]["Enums"]["ai_audit_severity"];
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          event_data?: Json;
          event_type?: Database["public"]["Enums"]["ai_audit_event_type"];
          id?: string;
          ip_address?: unknown;
          request_id?: string | null;
          session_id?: string | null;
          severity?: Database["public"]["Enums"]["ai_audit_severity"];
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ai_memory: {
        Row: {
          created_at: string;
          embedding: string | null;
          expires_at: string | null;
          id: string;
          key: string;
          memory_type: Database["public"]["Enums"]["ai_memory_type"];
          metadata: Json;
          session_id: string;
          updated_at: string;
          user_id: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          embedding?: string | null;
          expires_at?: string | null;
          id?: string;
          key: string;
          memory_type?: Database["public"]["Enums"]["ai_memory_type"];
          metadata?: Json;
          session_id: string;
          updated_at?: string;
          user_id?: string;
          value?: Json;
        };
        Update: {
          created_at?: string;
          embedding?: string | null;
          expires_at?: string | null;
          id?: string;
          key?: string;
          memory_type?: Database["public"]["Enums"]["ai_memory_type"];
          metadata?: Json;
          session_id?: string;
          updated_at?: string;
          user_id?: string;
          value?: Json;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          author_id: string | null;
          category: string[];
          content_html: string | null;
          content_md: string;
          cover_image_url: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          meta_description: string | null;
          meta_title: string | null;
          published_at: string | null;
          reading_minutes: number;
          slug: string;
          status: Database["public"]["Enums"]["article_status"];
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          category?: string[];
          content_html?: string | null;
          content_md: string;
          cover_image_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          reading_minutes?: number;
          slug: string;
          status?: Database["public"]["Enums"]["article_status"];
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          category?: string[];
          content_html?: string | null;
          content_md?: string;
          cover_image_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          reading_minutes?: number;
          slug?: string;
          status?: Database["public"]["Enums"]["article_status"];
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          budget: string | null;
          company: string | null;
          created_at: string;
          email: string;
          id: string;
          locale: string;
          message: string;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          budget?: string | null;
          company?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          locale?: string;
          message: string;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          budget?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          locale?: string;
          message?: string;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json;
          session_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          session_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          session_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          id: string;
          metadata: Json;
        };
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_documents: {
        Row: {
          author: string | null;
          content: string;
          content_hash: string | null;
          created_at: string;
          id: string;
          locale: string;
          metadata: Json;
          priority: number;
          source_path: string | null;
          source_type: Database["public"]["Enums"]["knowledge_doc_type"];
          source_url: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          version: string | null;
        };
        Insert: {
          author?: string | null;
          content: string;
          content_hash?: string | null;
          created_at?: string;
          id?: string;
          locale?: string;
          metadata?: Json;
          priority?: number;
          source_path?: string | null;
          source_type?: Database["public"]["Enums"]["knowledge_doc_type"];
          source_url?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          version?: string | null;
        };
        Update: {
          author?: string | null;
          content?: string;
          content_hash?: string | null;
          created_at?: string;
          id?: string;
          locale?: string;
          metadata?: Json;
          priority?: number;
          source_path?: string | null;
          source_type?: Database["public"]["Enums"]["knowledge_doc_type"];
          source_url?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          version?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          conversation_id: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          id: string;
          metadata: Json;
          phone: string | null;
          session_id: string;
          summary: string;
        };
        Insert: {
          conversation_id?: string | null;
          created_at?: string;
          email?: string | null;
          first_name: string;
          id?: string;
          metadata?: Json;
          phone?: string | null;
          session_id: string;
          summary: string;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          id?: string;
          metadata?: Json;
          phone?: string | null;
          session_id?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          role: string;
          tool_call_id: string | null;
          tool_calls: Json | null;
          tool_name: string | null;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role: string;
          tool_call_id?: string | null;
          tool_calls?: Json | null;
          tool_name?: string | null;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role?: string;
          tool_call_id?: string | null;
          tool_calls?: Json | null;
          tool_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      realisations: {
        Row: {
          author_id: string | null;
          category: string[];
          client_name: string | null;
          cover_image_url: string | null;
          created_at: string;
          description_html: string | null;
          description_md: string;
          featured: boolean;
          gallery_images: string[];
          github_url: string | null;
          id: string;
          meta_description: string | null;
          meta_title: string | null;
          project_url: string | null;
          published_at: string | null;
          short_description: string | null;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["realisation_status"];
          technologies: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          category?: string[];
          client_name?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description_html?: string | null;
          description_md: string;
          featured?: boolean;
          gallery_images?: string[];
          github_url?: string | null;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          project_url?: string | null;
          published_at?: string | null;
          short_description?: string | null;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["realisation_status"];
          technologies?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          category?: string[];
          client_name?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description_html?: string | null;
          description_md?: string;
          featured?: boolean;
          gallery_images?: string[];
          github_url?: string | null;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          project_url?: string | null;
          published_at?: string | null;
          short_description?: string | null;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["realisation_status"];
          technologies?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_slug: {
        Args: { input_text: string };
        Returns: string;
      };
      get_articles_stats: {
        Args: never;
        Returns: Json;
      };
      get_memory_stats: {
        Args: never;
        Returns: Json;
      };
      get_realisations_stats: {
        Args: never;
        Returns: Json;
      };
      is_admin: {
        Args: never;
        Returns: boolean;
      };
      match_knowledge_chunks: {
        Args: {
          filter_locale?: string;
          filter_source_type?: Database["public"]["Enums"]["knowledge_doc_type"];
          match_count?: number;
          match_threshold?: number;
          query_embedding: string;
        };
        Returns: {
          chunk_content: string;
          chunk_id: string;
          chunk_index: number;
          chunk_metadata: Json;
          document_id: string;
          document_locale: string;
          document_metadata: Json;
          document_source_path: string;
          document_source_type: Database["public"]["Enums"]["knowledge_doc_type"];
          document_source_url: string;
          document_title: string;
          similarity: number;
        }[];
      };
      show_limit: {
        Args: never;
        Returns: number;
      };
      show_trgm: {
        Args: { "": string };
        Returns: string[];
      };
    };
    Enums: {
      ai_audit_event_type:
        | "auth_failure"
        | "rate_limit_exceeded"
        | "unauthorized_tool_access"
        | "prompt_injection_detected"
        | "validation_failure"
        | "provider_error"
        | "tool_execution_failure"
        | "memory_access_violation"
        | "rag_access_violation"
        | "permission_denied"
        | "oversized_payload"
        | "context_too_large"
        | "max_steps_exceeded"
        | "suspicious_activity"
        | "lead_created";
      ai_audit_severity: "low" | "medium" | "high" | "critical";
      ai_memory_type: "conversation" | "context" | "knowledge" | "preference";
      article_status: "draft" | "published" | "archived";
      knowledge_doc_type: "website" | "pdf" | "manual" | "faq" | "blog" | "case_study";
      realisation_status: "draft" | "published" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_audit_event_type: [
        "auth_failure",
        "rate_limit_exceeded",
        "unauthorized_tool_access",
        "prompt_injection_detected",
        "validation_failure",
        "provider_error",
        "tool_execution_failure",
        "memory_access_violation",
        "rag_access_violation",
        "permission_denied",
        "oversized_payload",
        "context_too_large",
        "max_steps_exceeded",
        "suspicious_activity",
        "lead_created",
      ],
      ai_audit_severity: ["low", "medium", "high", "critical"],
      ai_memory_type: ["conversation", "context", "knowledge", "preference"],
      article_status: ["draft", "published", "archived"],
      knowledge_doc_type: ["website", "pdf", "manual", "faq", "blog", "case_study"],
      realisation_status: ["draft", "published", "archived"],
    },
  },
} as const;
