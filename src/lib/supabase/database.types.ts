export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          key: string
          memory_type: Database["public"]["Enums"]["ai_memory_type"]
          metadata: Json
          session_id: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          key: string
          memory_type: Database["public"]["Enums"]["ai_memory_type"]
          metadata?: Json
          session_id: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          memory_type?: Database["public"]["Enums"]["ai_memory_type"]
          metadata?: Json
          session_id?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string | null
          category: string[]
          content_html: string | null
          content_md: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          reading_minutes: number
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string[]
          content_html?: string | null
          content_md: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_minutes?: number
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string[]
          content_html?: string | null
          content_md?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_minutes?: number
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      realisations: {
        Row: {
          author_id: string | null
          category: string[]
          client_name: string | null
          cover_image_url: string | null
          created_at: string
          description_html: string | null
          description_md: string
          featured: boolean
          gallery_images: string[]
          github_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          project_url: string | null
          published_at: string | null
          short_description: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["realisation_status"]
          technologies: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string[]
          client_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          description_html?: string | null
          description_md: string
          featured?: boolean
          gallery_images?: string[]
          github_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          project_url?: string | null
          published_at?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["realisation_status"]
          technologies?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string[]
          client_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          description_html?: string | null
          description_md?: string
          featured?: boolean
          gallery_images?: string[]
          github_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          project_url?: string | null
          published_at?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["realisation_status"]
          technologies?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      generate_slug: { Args: { input_text: string }; Returns: string }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      get_articles_stats: { Args: Record<string, never>; Returns: { total: number; published: number; drafts: number } }
      get_realisations_stats: { Args: Record<string, never>; Returns: { total: number; published: number; drafts: number; featured: number } }
      get_memory_stats: { Args: Record<string, never>; Returns: { total: number; sessions: number; byType: Array<{ memory_type: string; count: number }> } }
    }
    Enums: {
      ai_memory_type: "conversation" | "context" | "knowledge" | "preference"
      article_status: "draft" | "published" | "archived"
      realisation_status: "draft" | "published" | "archived"
    }
  }
}
