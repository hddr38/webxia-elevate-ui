import type { DocumentMetadata, DocumentSource } from "../contracts";
import type { KnowledgeRepository, StoredKnowledgeDocument } from "./repository";
import { chunkTextIntoPieces, DEFAULT_CHUNKER_OPTIONS } from "./chunker";
import { assertEmbeddingDimensions } from "../embeddings/config";

export interface IngestionSourceInput {
  title: string;
  rawContent: string;
  sourceType: DocumentSource["type"];
  sourceUrl?: string;
  sourcePath?: string;
  version?: string;
  author?: string;
  locale?: string;
  tags?: string[];
  priority?: number;
}

export interface IngestionDeps {
  repository: KnowledgeRepository;
  /** Batch embedder (embedding provider). Must emit EMBEDDING_CONFIG.dimensions. */
  embedTexts: (texts: string[]) => Promise<number[][]>;
}

export interface IngestionOptions {
  /** Delete and rebuild an existing document instead of skipping it. */
  forceReindex?: boolean;
  /** Max texts per embedding batch (bounds payload size). */
  batchSize?: number;
  maxChars?: number;
  overlapChars?: number;
}

export type IngestionStatus = "created" | "already_exists" | "reindexed";

export interface IngestionResult {
  documentId: string;
  title: string;
  status: IngestionStatus;
  chunkCount: number;
  contentHash: string;
}

export type IngestionErrorCode = "EMPTY_CONTENT" | "EMBEDDING_FAILED" | "PERSIST_FAILED";

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;
  constructor(code: IngestionErrorCode, message: string) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
  }
}

/**
 * Normalizes raw markdown/text for hashing + chunking: CRLF, front-matter,
 * trailing spaces, 3+ blank lines collapsed. Two files that differ only by
 * these produce the same content_hash (no silent duplicates).
 */
export function normalizeContent(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  // Strip YAML front-matter (--- block at the very start).
  if (text.startsWith("---")) {
    const closing = text.indexOf("\n---", 3);
    if (closing >= 0) {
      const after = text.indexOf("\n", closing + 4);
      text = after >= 0 ? text.slice(after + 1) : "";
    }
  }
  const lines = text.split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** sha256 hex of the NORMALIZED content (Web Crypto, no node-only import). */
export async function computeContentHash(normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function batchEmbedAll(
  embedTexts: (texts: string[]) => Promise<number[][]>,
  texts: string[],
  batchSize: number,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += batchSize) {
    const batch = texts.slice(offset, offset + batchSize);
    let vectors: number[][];
    try {
      vectors = await embedTexts(batch);
    } catch (error) {
      throw new IngestionError(
        "EMBEDDING_FAILED",
        `Embedding batch failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
    if (vectors.length !== batch.length) {
      throw new IngestionError(
        "EMBEDDING_FAILED",
        `Embedding count mismatch: expected ${batch.length}, received ${vectors.length}`,
      );
    }
    for (const vector of vectors) {
      try {
        assertEmbeddingDimensions(vector);
      } catch {
        throw new IngestionError(
          "EMBEDDING_FAILED",
          "Embedding dimension invalid (vectors are never resized)",
        );
      }
    }
    out.push(...vectors);
  }
  return out;
}

/**
 * Full pipeline: normalize -> hash -> dedupe -> chunk -> batch-embed -> persist.
 * Same normalized content + no forceReindex -> "already_exists" WITHOUT any
 * re-embedding. Throws IngestionError (typed) on empty content, embedding or
 * persistence failures.
 */
export async function ingestDocument(
  input: IngestionSourceInput,
  deps: IngestionDeps,
  options: IngestionOptions = {},
): Promise<IngestionResult> {
  const normalized = normalizeContent(input.rawContent);
  if (normalized.length === 0) {
    throw new IngestionError("EMPTY_CONTENT", "Document content is empty after normalization");
  }
  const contentHash = await computeContentHash(normalized);
  const forceReindex = options.forceReindex ?? false;

  const existing = await deps.repository.findDocumentByHash(contentHash);
  if (existing && !forceReindex) {
    return {
      documentId: existing.id,
      title: existing.title,
      status: "already_exists",
      chunkCount: 0,
      contentHash,
    };
  }
  if (existing && forceReindex) {
    await deps.repository.deleteDocument(existing.id);
  }

  const pieces = chunkTextIntoPieces(normalized, {
    maxChars: options.maxChars ?? DEFAULT_CHUNKER_OPTIONS.maxChars,
    overlapChars: options.overlapChars ?? DEFAULT_CHUNKER_OPTIONS.overlapChars,
  });
  if (pieces.length === 0) {
    throw new IngestionError("EMPTY_CONTENT", "Chunker produced no chunks");
  }

  const batchSize = Math.min(100, Math.max(1, Math.floor(options.batchSize ?? 32)));
  const embeddings = await batchEmbedAll(
    deps.embedTexts,
    pieces.map((piece) => piece.content),
    batchSize,
  );

  const locale = input.locale ?? "fr";
  const metadata: DocumentMetadata = {
    author: input.author,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: input.tags ?? [],
    locale,
    priority: input.priority ?? 0,
  };

  let stored: StoredKnowledgeDocument;
  try {
    stored = await deps.repository.createDocument({
      title: input.title,
      content: normalized,
      source: {
        type: input.sourceType,
        url: input.sourceUrl,
        path: input.sourcePath,
        version: input.version,
      },
      metadata,
      contentHash,
    });
  } catch (error) {
    // Race-safe idempotence: a concurrent ingest may have won the UNIQUE.
    const raced = await deps.repository.findDocumentByHash(contentHash).catch(() => null);
    if (raced) {
      return {
        documentId: raced.id,
        title: raced.title,
        status: "already_exists",
        chunkCount: 0,
        contentHash,
      };
    }
    throw new IngestionError(
      "PERSIST_FAILED",
      `createDocument failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  try {
    await deps.repository.createChunks(
      stored.id,
      pieces.map((piece, index) => ({
        chunkIndex: index,
        content: piece.content,
        embedding: embeddings[index],
        metadata: {
          chunk_index: index,
          char_start: piece.charStart,
          char_end: piece.charEnd,
          token_estimate: piece.tokenEstimate,
        },
      })),
    );
  } catch (error) {
    throw new IngestionError(
      "PERSIST_FAILED",
      `createChunks failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  return {
    documentId: stored.id,
    title: stored.title,
    status: existing ? "reindexed" : "created",
    chunkCount: pieces.length,
    contentHash,
  };
}
