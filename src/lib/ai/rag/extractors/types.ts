import type { Database } from "@/lib/supabase/database.types";
import { MemorySourceIdentity } from "../../contracts/source-key";

export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export type RealisationRow = Database["public"]["Tables"]["realisations"]["Row"];

/**
 * Document prêt à être ingéré par le pipeline RAG (INGEST-3b).
 *
 * Tous les champs sont strictement typés. Aucune valeur `any`.
 */
export interface ExtractedDocument {
  identity: MemorySourceIdentity;
  title: string;
  content: string;
  sourceUrl: string;
  sourcePath: string;
  metadata: Record<string, unknown>;
}

/** Nombre minimal de caractères du contenu normalisé pour qu'un document soit ingérable. */
export const MIN_CONTENT_CHARS = 200;
