import { describe, it, expect } from "vitest";
import {
  EMBEDDING_CONFIG,
  EmbeddingDimensionError,
  assertEmbeddingDimensions,
  clampThreshold,
  clampTopK,
  resolveEmbeddingModel,
  serializeEmbedding,
} from "./config";

describe("EmbeddingConfig", () => {
  it("is the validated single source of truth", () => {
    expect(EMBEDDING_CONFIG.provider).toBe("nvidia");
    expect(EMBEDDING_CONFIG.model).toBe("nvidia/nemotron-3-embed-1b");
    expect(EMBEDDING_CONFIG.dimensions).toBe(2048);
    expect(EMBEDDING_CONFIG.defaultTopK).toBe(5);
    expect(EMBEDDING_CONFIG.defaultThreshold).toBe(0.7);
    expect(EMBEDDING_CONFIG.maxTopK).toBe(20);
  });

  it("resolves the model from config by default", () => {
    expect(resolveEmbeddingModel()).toBe("nvidia/nemotron-3-embed-1b");
  });
});

describe("assertEmbeddingDimensions", () => {
  it("accepts 2048-dim vectors", () => {
    expect(() => assertEmbeddingDimensions(new Array(2048).fill(0))).not.toThrow();
  });

  it("rejects 1536-dim vectors with a typed error", () => {
    try {
      assertEmbeddingDimensions(new Array(1536).fill(0));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EmbeddingDimensionError);
      const typed = error as EmbeddingDimensionError;
      expect(typed.code).toBe("EMBEDDING_DIMENSION_MISMATCH");
      expect(typed.expected).toBe(2048);
      expect(typed.received).toBe(1536);
    }
  });

  it("rejects empty vectors", () => {
    expect(() => assertEmbeddingDimensions([])).toThrow(EmbeddingDimensionError);
  });
});

describe("serializeEmbedding", () => {
  it("serializes valid vectors to pgvector text format", () => {
    const text = serializeEmbedding(new Array(2048).fill(0.5));
    expect(text.startsWith("[0.5,0.5")).toBe(true);
    expect(JSON.parse(text) as number[]).toHaveLength(2048);
  });

  it("refuses to serialize wrong-dimension vectors", () => {
    expect(() => serializeEmbedding([0.1, 0.2])).toThrow(EmbeddingDimensionError);
  });
});

describe("retrieval bounds", () => {
  it("clamps topK to [1, maxTopK] with config default", () => {
    expect(clampTopK(undefined)).toBe(5);
    expect(clampTopK(0)).toBe(1);
    expect(clampTopK(3)).toBe(3);
    expect(clampTopK(20)).toBe(20);
    expect(clampTopK(999)).toBe(20);
  });

  it("clamps threshold to [0, 1] with config default", () => {
    expect(clampThreshold(undefined)).toBe(0.7);
    expect(clampThreshold(-1)).toBe(0);
    expect(clampThreshold(0.5)).toBe(0.5);
    expect(clampThreshold(2)).toBe(1);
  });
});
