export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
          ip_address: string | null;
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
          ip_address?: string | null;
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
          ip_address?: string | null;
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
          memory_type: Database["public"]["Enums"]["ai_memory_type"];
          metadata?: Json;
          session_id: string;
          updated_at?: string;
          user_id: string;
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
        Relationships: [];
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
          source_type: Database["public"]["Enums"]["knowledge_doc_type"];
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
        Relationships: [];
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
    Views: Record<string, never>;
    Functions: {
      generate_slug: { Args: { input_text: string }; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      get_articles_stats: {
        Args: Record<string, never>;
        Returns: { total: number; published: number; drafts: number };
      };
      get_realisations_stats: {
        Args: Record<string, never>;
        Returns: { total: number; published: number; drafts: number; featured: number };
      };
      get_memory_stats: {
        Args: Record<string, never>;
        Returns: {
          total: number;
          sessions: number;
          byType: Array<{ memory_type: string; count: number }>;
        };
      };
      match_knowledge_chunks: {
        Args: {
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
          filter_locale?: string | null;
          filter_source_type?: Database["public"]["Enums"]["knowledge_doc_type"] | null;
        };
        Returns: Array<{
          chunk_id: string;
          document_id: string;
          chunk_index: number;
          chunk_content: string;
          chunk_metadata: Json;
          document_title: string;
          document_source_type: Database["public"]["Enums"]["knowledge_doc_type"];
          document_source_url: string | null;
          document_source_path: string | null;
          document_locale: string;
          document_metadata: Json;
          similarity: number;
        }>;
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
        | "suspicious_activity";
      ai_audit_severity: "low" | "medium" | "high" | "critical";
      ai_memory_type: "conversation" | "context" | "knowledge" | "preference";
      article_status: "draft" | "published" | "archived";
      knowledge_doc_type: "website" | "pdf" | "manual" | "faq" | "blog" | "case_study";
      realisation_status: "draft" | "published" | "archived";
    };
  };
};
