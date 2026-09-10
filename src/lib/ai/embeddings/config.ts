/**
 * EmbeddingConfig — single source of truth for ALL embeddings in Webi.
 *
 * Validated decision (Prompt 3B §0): NVIDIA NIM `nvidia/nemotron-3-embed-1b`,
 * native 2048 dimensions. RAG, ai_memory, ingestion and retrieval MUST share
 * exactly this configuration. No other module may hardcode embedding model
 * names or dimensions (1536, 2048 or otherwise).
 */

/** Central embedding configuration. Immutable by construction. */
export interface EmbeddingConfig {
  /** Embedding provider id. Only "nvidia" is supported. */
  readonly provider: "nvidia";
  /** Exact NIM model id sent to POST /v1/embeddings. */
  readonly model: "nvidia/nemotron-3-embed-1b";
  /** Native embedding dimensions. The ONLY value the model emits. */
  readonly dimensions: 2048;
  /** Default retrieval fan-out. */
  readonly defaultTopK: 5;
  /** Default cosine-similarity floor. Below it, nothing is injected. */
  readonly defaultThreshold: 0.7;
  /** Hard server-side ceiling for topK (retrieval bounding). */
  readonly maxTopK: 20;
}

export const EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: "nvidia",
  model: "nvidia/nemotron-3-embed-1b",
  dimensions: 2048,
  defaultTopK: 5,
  defaultThreshold: 0.7,
  maxTopK: 20,
};

/**
 * Resolves the embedding model id. The dimension stays controlled by
 * EMBEDDING_CONFIG (never by env): a custom model name that does not emit
 * 2048 dims fails loudly at validation time (assertEmbeddingDimensions).
 */
export function resolveEmbeddingModel(): string {
  const fromEnv = readEnv("NVIDIA_NIM_EMBEDDING_MODEL");
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return EMBEDDING_CONFIG.model;
}

function readEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env && key in process.env) {
    return process.env[key];
  }
  if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
    const value: unknown = import.meta.env[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/** Typed error raised when a vector does not match EMBEDDING_CONFIG.dimensions. */
export class EmbeddingDimensionError extends Error {
  readonly expected: number;
  readonly received: number;
  readonly code = "EMBEDDING_DIMENSION_MISMATCH" as const;

  constructor(received: number, expected: number = EMBEDDING_CONFIG.dimensions) {
    super(
      `Embedding dimension mismatch: expected ${expected}, received ${received}. ` +
        `Vectors are never truncated, padded or sliced — check the embedding model.`,
    );
    this.name = "EmbeddingDimensionError";
    this.expected = expected;
    this.received = received;
  }
}

/**
 * Runtime guard: fails explicitly when a vector length differs from the
 * central configuration. Never truncates, pads, slices or recomputes.
 */
export function assertEmbeddingDimensions(
  vector: readonly number[],
  expected: number = EMBEDDING_CONFIG.dimensions,
): void {
  if (vector.length !== expected) {
    throw new EmbeddingDimensionError(vector.length, expected);
  }
}

/**
 * Serializes an embedding to the pgvector text wire format (`[0.1,0.2,…]`,
 * also valid JSON). Validates dimensions first.
 */
export function serializeEmbedding(vector: readonly number[]): string {
  assertEmbeddingDimensions(vector);
  return JSON.stringify(Array.from(vector));
}

/** Clamps retrieval parameters server-side. */
export function clampTopK(topK: number | undefined): number {
  if (topK === undefined || Number.isNaN(topK)) return EMBEDDING_CONFIG.defaultTopK;
  return Math.min(EMBEDDING_CONFIG.maxTopK, Math.max(1, Math.floor(topK)));
}

/** Clamps similarity thresholds to [0, 1]. */
export function clampThreshold(threshold: number | undefined): number {
  if (threshold === undefined || Number.isNaN(threshold)) return EMBEDDING_CONFIG.defaultThreshold;
  return Math.min(1, Math.max(0, threshold));
}
