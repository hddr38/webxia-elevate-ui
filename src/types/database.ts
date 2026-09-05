import type { Database } from "@/lib/supabase/database.types";

// --- Enums ---
export type ArticleStatus = Database["public"]["Enums"]["article_status"];
export type RealisationStatus = Database["public"]["Enums"]["realisation_status"];
export type AIMemoryType = Database["public"]["Enums"]["ai_memory_type"];

// --- Row types ---
export type AdminUser = Database["public"]["Tables"]["admin_users"]["Row"];
export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type Realisation = Database["public"]["Tables"]["realisations"]["Row"];
export type AIMemory = Database["public"]["Tables"]["ai_memory"]["Row"];

// --- Insert types (author_id injected server-side) ---
type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];
type RealisationInsert = Database["public"]["Tables"]["realisations"]["Insert"];
type AIMemoryInsert = Database["public"]["Tables"]["ai_memory"]["Insert"];

export type CreateArticleInput = Omit<ArticleInsert, "author_id">;
export type CreateRealisationInput = Omit<RealisationInsert, "author_id">;
export type CreateAIMemoryInput = Omit<AIMemoryInsert, "user_id">;

// --- Update types (require id) ---
export type UpdateArticleInput = Partial<Database["public"]["Tables"]["articles"]["Update"]> & { id: string };
export type UpdateRealisationInput = Partial<Database["public"]["Tables"]["realisations"]["Update"]> & { id: string };
export type UpdateAIMemoryInput = Partial<Database["public"]["Tables"]["ai_memory"]["Update"]> & { id: string };
