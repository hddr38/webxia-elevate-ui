import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { DocumentMetadata, DocumentSource } from "../contracts";
import {
  assertEmbeddingDimensions,
  clampThreshold,
  clampTopK,
  serializeEmbedding,
} from "../embeddings/config";

type KnowledgeDbClient = SupabaseClient<Database>;
export type KnowledgeDocType = Database["public"]["Enums"]["knowledge_doc_type"];
type DocumentRow = Database["public"]["Tables"]["knowledge_documents"]["Row"];
type ChunkRow = Database["public"]["Tables"]["knowledge_chunks"]["Row"];
type MatchRow = Database["public"]["Functions"]["match_knowledge_chunks"]["Returns"][number];

/**
 * Source descriptor accepted on write.
 *
 * The DB enum (`knowledge_doc_type`) is wider than the shared RAG contract
 * (`DocumentSource`): since migration 021 it also carries the business types
 * (article | realisation | service) written by the business pipeline.
 */
export interface KnowledgeSource extends Omit<DocumentSource, "type"> {
  type: KnowledgeDocType;
}

/** Input for creating a knowledge document (ingestion). */
interface KnowledgeDocumentInput {
  /** Explicit id (compat/migration paths). Omitted -> database generates one. */
  id?: string;
  title: string;
  content: string;
  source: KnowledgeSource;
  metadata: DocumentMetadata;
  /** sha256 of the normalized content. Enables idempotent ingestion. */
  contentHash?: string;
  /**
   * Stable business identity key (migration 021):
   * `<sourceType>:<slug>:<locale>:<version>`. NULL = legacy document
   * (identity = content_hash only).
   */
  sourceKey?: string | null;
}

/** Patch for updating a knowledge document. */
interface KnowledgeDocumentPatch {
  title?: string;
  content?: string;
  source?: DocumentSource;
  metadata?: DocumentMetadata;
  tags?: string[];
  priority?: number;
  locale?: string;
  contentHash?: string | null;
}

/** Domain view of a stored knowledge document. */
export interface StoredKnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source: KnowledgeSource;
  metadata: DocumentMetadata;
  contentHash: string | null;
  /** Stable business identity key (migration 021). NULL = legacy document. */
  sourceKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input for persisting one chunk (embedding validated against EmbeddingConfig). */
interface NewKnowledgeChunk {
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

/** Domain view of a stored knowledge chunk (vectors never leave the DB). */
interface StoredKnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** One server-side vector-search hit. Identities are always kept separate. */
export interface KnowledgeMatch {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  chunkContent: string;
  chunkMetadata: Record<string, unknown>;
  documentTitle: string;
  source: DocumentSource;
  locale: string;
  documentMetadata: DocumentMetadata;
  similarity: number;
}

/** Bounded search parameters (server clamps topK/threshold). */
interface ChunkSearchParams {
  embedding: number[];
  topK?: number;
  threshold?: number;
  locale?: string;
  sourceType?: KnowledgeDocType;
}

interface DocumentListFilters {
  locale?: string;
  sourceType?: KnowledgeDocType;
}

type KnowledgeRepositoryErrorCode = "NOT_FOUND" | "DB_ERROR" | "DIMENSION_MISMATCH";

export class KnowledgeRepositoryError extends Error {
  readonly code: KnowledgeRepositoryErrorCode;
  constructor(code: KnowledgeRepositoryErrorCode, message: string) {
    super(message);
    this.name = "KnowledgeRepositoryError";
    this.code = code;
  }
}

function toRecord(value: Json): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }
  return {};
}

/** Narrowing guard: only Json-compatible values cross the DB boundary. */
function isJson(value: unknown): value is Json {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === "string" || kind === "number" || kind === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJson);
  if (kind === "object") {
    return Object.values(value as Record<string, unknown>).every(
      (entry) => entry === undefined || isJson(entry),
    );
  }
  return false;
}

/** Sanitizes caller metadata to Json (drops non-serializable entries). */
function toJson(value: Record<string, unknown>): Json {
  const clean: Record<string, Json> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (isJson(entry)) clean[key] = entry;
  }
  return clean;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? (value as string[])
    : [];
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toDocumentMetadata(row: DocumentRow): DocumentMetadata {
  const extra = toRecord(row.metadata);
  const tags = toStringArray(extra["tags"]).length > 0 ? toStringArray(extra["tags"]) : row.tags;
  return {
    author: typeof extra["author"] === "string" ? extra["author"] : (row.author ?? undefined),
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
    tags,
    locale: row.locale,
    priority: row.priority,
    ...extra,
  };
}

function toSource(
  row: Pick<DocumentRow, "source_type" | "source_url" | "source_path">,
): KnowledgeSource {
  return {
    type: row.source_type,
    url: row.source_url ?? undefined,
    path: row.source_path ?? undefined,
  };
}

/**
 * Narrows a DB document type to the shared RAG contract.
 *
 * The DB enum (migration 021) also carries the business types
 * (article | realisation | service) while `DocumentSource` still models the 6
 * legacy types. The runtime value is preserved as-is; the shared contract is
 * widened in INGEST-3b (contracts/domain.ts is out of the INGEST-3a scope).
 */
function toSharedSourceType(type: KnowledgeDocType): DocumentSource["type"] {
  return type as DocumentSource["type"];
}

function toStoredDocument(row: DocumentRow): StoredKnowledgeDocument {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: toSource(row),
    metadata: toDocumentMetadata(row),
    contentHash: row.content_hash,
    sourceKey: row.source_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChunk(row: ChunkRow): StoredKnowledgeChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
  };
}

function toMatch(row: MatchRow): KnowledgeMatch {
  const docExtra = toRecord(row.document_metadata);
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    chunkContent: row.chunk_content,
    chunkMetadata: toRecord(row.chunk_metadata),
    documentTitle: row.document_title,
    source: {
      type: toSharedSourceType(row.document_source_type),
      url: row.document_source_url ?? undefined,
      path: row.document_source_path ?? undefined,
    },
    locale: row.document_locale,
    documentMetadata: {
      createdAt: 0,
      updatedAt: 0,
      tags: [],
      locale: row.document_locale,
      priority: typeof docExtra["priority"] === "number" ? docExtra["priority"] : 0,
      ...docExtra,
    },
    similarity: row.similarity,
  };
}

function dbError(message: string, cause: unknown): KnowledgeRepositoryError {
  const detail =
    cause !== null && typeof cause === "object" && "message" in cause
      ? String((cause as { message: unknown }).message)
      : "unknown database error";
  return new KnowledgeRepositoryError("DB_ERROR", `${message}: ${detail}`);
}

/**
 * The ONLY module allowed to talk to Supabase for RAG. Server-side only
 * (service-role client injected by the caller). Never leaks raw DB rows:
 * every method maps to domain objects and wraps failures in
 * KnowledgeRepositoryError.
 */
export interface KnowledgeRepository {
  createDocument(input: KnowledgeDocumentInput): Promise<StoredKnowledgeDocument>;
  getDocument(id: string): Promise<StoredKnowledgeDocument>;
  listDocuments(
    filters: DocumentListFilters,
    limit: number,
    offset: number,
  ): Promise<{ data: StoredKnowledgeDocument[]; total: number }>;
  updateDocument(id: string, patch: KnowledgeDocumentPatch): Promise<StoredKnowledgeDocument>;
  deleteDocument(id: string): Promise<void>;
  /**
   * LEGACY identity lookup: matches a content hash ONLY on legacy rows
   * (`source_key IS NULL`). Business rows are never returned here.
   */
  findDocumentByHash(contentHash: string): Promise<StoredKnowledgeDocument | null>;
  /**
   * Business identity lookup (migration 021): matches `source_key`.
   *
   * Optional on the interface so the legacy test doubles stay valid; the
   * Supabase repository always implements it. Ingestion REQUIRES it as soon
   * as an identity is provided.
   */
  findDocumentByKey?(sourceKey: string): Promise<StoredKnowledgeDocument | null>;
  createChunks(documentId: string, chunks: NewKnowledgeChunk[]): Promise<StoredKnowledgeChunk[]>;
  deleteChunks(documentId: string): Promise<void>;
  searchChunks(params: ChunkSearchParams): Promise<KnowledgeMatch[]>;
}

export function createKnowledgeRepository(client: KnowledgeDbClient): KnowledgeRepository {
  return {
    async createDocument(input: KnowledgeDocumentInput): Promise<StoredKnowledgeDocument> {
      const { data, error } = await client
        .from("knowledge_documents")
        .insert({
          ...(input.id ? { id: input.id } : {}),
          title: input.title,
          content: input.content,
          source_type: input.source.type,
          source_url: input.source.url ?? null,
          source_path: input.source.path ?? null,
          version: input.source.version ?? null,
          author: input.metadata.author ?? null,
          locale: input.metadata.locale,
          tags: input.metadata.tags,
          priority: input.metadata.priority,
          metadata: toJson({ ...input.metadata }),
          content_hash: input.contentHash ?? null,
          source_key: input.sourceKey ?? null,
        })
        .select()
        .single();
      if (error || !data) throw dbError("createDocument failed", error);
      return toStoredDocument(data);
    },

    async getDocument(id: string): Promise<StoredKnowledgeDocument> {
      const { data, error } = await client
        .from("knowledge_documents")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        if (error && "code" in error && error.code === "PGRST116") {
          throw new KnowledgeRepositoryError("NOT_FOUND", `Document ${id} not found`);
        }
        throw dbError("getDocument failed", error);
      }
      return toStoredDocument(data);
    },

    async listDocuments(
      filters: DocumentListFilters,
      limit: number,
      offset: number,
    ): Promise<{ data: StoredKnowledgeDocument[]; total: number }> {
      const safeLimit = Math.min(100, Math.max(1, limit));
      const safeOffset = Math.max(0, offset);
      let builder = client
        .from("knowledge_documents")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (filters.locale) builder = builder.eq("locale", filters.locale);
      if (filters.sourceType) builder = builder.eq("source_type", filters.sourceType);
      const { data, error, count } = await builder.range(safeOffset, safeOffset + safeLimit - 1);
      if (error) throw dbError("listDocuments failed", error);
      return { data: (data ?? []).map(toStoredDocument), total: count ?? 0 };
    },

    async updateDocument(
      id: string,
      patch: KnowledgeDocumentPatch,
    ): Promise<StoredKnowledgeDocument> {
      const update: Database["public"]["Tables"]["knowledge_documents"]["Update"] = {};
      if (patch.title !== undefined) update.title = patch.title;
      if (patch.content !== undefined) update.content = patch.content;
      if (patch.locale !== undefined) update.locale = patch.locale;
      if (patch.tags !== undefined) update.tags = patch.tags;
      if (patch.priority !== undefined) update.priority = patch.priority;
      if (patch.contentHash !== undefined) update.content_hash = patch.contentHash;
      if (patch.metadata !== undefined) {
        update.metadata = toJson({ ...patch.metadata });
        if (patch.metadata.author !== undefined) update.author = patch.metadata.author ?? null;
        if (patch.metadata.locale !== undefined) update.locale = patch.metadata.locale;
        if (patch.metadata.tags !== undefined) update.tags = patch.metadata.tags;
        if (patch.metadata.priority !== undefined) update.priority = patch.metadata.priority;
      }
      if (patch.source !== undefined) {
        update.source_type = patch.source.type;
        if (patch.source.url !== undefined) update.source_url = patch.source.url ?? null;
        if (patch.source.path !== undefined) update.source_path = patch.source.path ?? null;
        if (patch.source.version !== undefined) update.version = patch.source.version ?? null;
      }
      const { data, error } = await client
        .from("knowledge_documents")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) {
        if (error && "code" in error && error.code === "PGRST116") {
          throw new KnowledgeRepositoryError("NOT_FOUND", `Document ${id} not found`);
        }
        throw dbError("updateDocument failed", error);
      }
      return toStoredDocument(data);
    },

    async deleteDocument(id: string): Promise<void> {
      // Explicit chunk delete first (FK cascade is the backstop, not the plan).
      await this.deleteChunks(id);
      const { error } = await client.from("knowledge_documents").delete().eq("id", id);
      if (error) throw dbError("deleteDocument failed", error);
    },

    async findDocumentByHash(contentHash: string): Promise<StoredKnowledgeDocument | null> {
      // LEGACY scope: only rows without a business identity (migration 021).
      const { data, error } = await client
        .from("knowledge_documents")
        .select("*")
        .eq("content_hash", contentHash)
        .is("source_key", null)
        .limit(1);
      if (error) throw dbError("findDocumentByHash failed", error);
      const row = (data ?? [])[0];
      return row ? toStoredDocument(row) : null;
    },

    async findDocumentByKey(sourceKey: string): Promise<StoredKnowledgeDocument | null> {
      const { data, error } = await client
        .from("knowledge_documents")
        .select("*")
        .eq("source_key", sourceKey)
        .limit(1);
      if (error) throw dbError("findDocumentByKey failed", error);
      const row = (data ?? [])[0];
      return row ? toStoredDocument(row) : null;
    },

    async createChunks(
      documentId: string,
      chunks: NewKnowledgeChunk[],
    ): Promise<StoredKnowledgeChunk[]> {
      if (chunks.length === 0) return [];
      for (const chunk of chunks) {
        try {
          assertEmbeddingDimensions(chunk.embedding);
        } catch {
          throw new KnowledgeRepositoryError(
            "DIMENSION_MISMATCH",
            `Chunk ${chunk.chunkIndex} embedding dimension is invalid (vectors are never resized)`,
          );
        }
      }
      const { data, error } = await client
        .from("knowledge_chunks")
        .upsert(
          chunks.map((chunk) => ({
            document_id: documentId,
            chunk_index: chunk.chunkIndex,
            content: chunk.content,
            embedding: serializeEmbedding(chunk.embedding),
            metadata: toJson(chunk.metadata),
          })),
          { onConflict: "document_id,chunk_index" },
        )
        .select();
      if (error) throw dbError("createChunks failed", error);
      return (data ?? []).map(toStoredChunk);
    },

    async deleteChunks(documentId: string): Promise<void> {
      const { error } = await client
        .from("knowledge_chunks")
        .delete()
        .eq("document_id", documentId);
      if (error) throw dbError("deleteChunks failed", error);
    },

    async searchChunks(params: ChunkSearchParams): Promise<KnowledgeMatch[]> {
      try {
        assertEmbeddingDimensions(params.embedding);
      } catch {
        throw new KnowledgeRepositoryError(
          "DIMENSION_MISMATCH",
          "Query embedding dimension is invalid (vectors are never resized)",
        );
      }
      const { data, error } = await client.rpc("match_knowledge_chunks", {
        query_embedding: serializeEmbedding(params.embedding),
        match_threshold: clampThreshold(params.threshold),
        match_count: clampTopK(params.topK),
        filter_locale: params.locale,
        filter_source_type: params.sourceType,
      });
      if (error) throw dbError("searchChunks failed", error);
      return (data ?? []).map(toMatch);
    },
  };
}
