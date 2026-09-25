import type {
  ScoredDocument,
  DocumentSource,
  DocumentMetadata,
  RetrievalStrategy,
} from "../contracts";
import type { KnowledgeDocType } from "./repository";

export type { KnowledgeDocType };

/**
 * Runtime mirror of the knowledge_doc_type DB enum. Single source of truth
 * for Zod schemas that accept a document type (skill input, validation).
 */
export const KNOWLEDGE_SOURCE_TYPES = [
  "website",
  "pdf",
  "manual",
  "faq",
  "blog",
  "case_study",
] as const;

export interface VectorStore {
  initialize(): Promise<void>;
  store(documents: KnowledgeDocument[]): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<RetrievalResult[]>;
  delete(documentId: string): Promise<void>;
  update(document: KnowledgeDocument): Promise<void>;
  clear(): Promise<void>;
}

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  strategy?: RetrievalStrategy;
  sessionId?: string;
  userId?: string;
  /**
   * Restrict retrieval to one locale (e.g. "fr"). Mirrors the
   * match_knowledge_chunks filter_locale parameter — the ONLY locale
   * mechanism (no per-document fallback, no second system).
   */
  locale?: string;
  /**
   * Restrict retrieval to one document type. Mirrors the
   * match_knowledge_chunks filter_source_type parameter.
   */
  sourceType?: KnowledgeDocType;
  /** Telemetry hook: receives the query-embedding duration (ms). */
  onEmbeddingMeasured?: (durationMs: number) => void;
}

/**
 * NOTE (LOT 2): document `tags` / `priority` are EDITORIAL metadata
 * (admin categorization, listing order — see idx_knowledge_documents_tags
 * and idx_knowledge_documents_priority). They are intentionally NOT
 * retrieval inputs: match_knowledge_chunks exposes only filter_locale +
 * filter_source_type, and blending priority into cosine ranking would
 * distort semantic relevance. No public contract may promise tag/priority
 * filtering — a former generic `metadataFilters` field was removed for
 * exactly this reason (it was accepted, then silently dropped).
 */

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source: DocumentSource;
  metadata: DocumentMetadata;
  /** One embedding PER CHUNK, in chunk order. Never a single flat vector. */
  embeddings?: number[][];
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
}

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  score: number;
  distance: number;
}
