import type {
  ScoredDocument,
  DocumentSource,
  DocumentMetadata,
  RetrievalStrategy,
} from "../contracts";
import type { KnowledgeDocType } from "./repository";

export type { KnowledgeDocType };

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
  metadataFilters?: Record<string, unknown>;
  strategy?: RetrievalStrategy;
  sessionId?: string;
  userId?: string;
  /** Restrict retrieval to one locale (e.g. "fr"). */
  locale?: string;
  /** Restrict retrieval to one document type. */
  sourceType?: KnowledgeDocType;
  /** Telemetry hook: receives the query-embedding duration (ms). */
  onEmbeddingMeasured?: (durationMs: number) => void;
}

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
