import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Retriever } from "../retriever";
import type { VectorStore, SearchOptions, RetrievalResult, KnowledgeDocument } from "../types";
import { EMBEDDING_CONFIG } from "../../embeddings/config";

type MockVectorStore = VectorStore & {
  search: Mock<(query: string, options?: SearchOptions) => Promise<RetrievalResult[]>>;
};

function mockMatch(chunkId: string, documentId: string, score: number): RetrievalResult {
  return {
    chunk: {
      id: chunkId,
      documentId,
      chunkIndex: 1,
      content: `Content of ${chunkId}`,
      embedding: undefined,
      metadata: { chunk_index: 1 },
    },
    document: {
      id: documentId,
      title: `Title of ${documentId}`,
      content: `Content of ${chunkId}`,
      source: { type: "manual" },
      metadata: {
        createdAt: 0,
        updatedAt: 0,
        tags: [],
        locale: "fr",
        priority: 0,
      },
    },
    score,
    distance: 1 - score,
  };
}

describe("Retriever (DB-first)", () => {
  let store: MockVectorStore;
  let retriever: Retriever;

  beforeEach(() => {
    store = {
      initialize: vi.fn().mockResolvedValue(undefined),
      store: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    retriever = new Retriever(store);
  });

  it("delegates vector search to the store with clamped bounds", async () => {
    store.search.mockResolvedValue([mockMatch("chunk-1", "doc-1", 0.9)]);

    const result = await retriever.retrieve({
      query: "tarifs",
      topK: 999,
      similarityThreshold: 5,
      locale: "fr",
      sourceType: "manual",
    });

    // Server-side bounding: topK capped at maxTopK, threshold at 1.
    expect(store.search).toHaveBeenCalledWith(
      "tarifs",
      expect.objectContaining({
        topK: EMBEDDING_CONFIG.maxTopK,
        similarityThreshold: 1,
        locale: "fr",
        sourceType: "manual",
      }),
    );
    expect(result.embeddingAvailable).toBe(true);
    expect(result.totalFound).toBe(1);
  });

  it("keeps chunk and document identities strictly separate", async () => {
    store.search.mockResolvedValue([
      mockMatch("chunk-A", "doc-A", 0.92),
      mockMatch("chunk-B", "doc-B", 0.81),
    ]);

    const result = await retriever.retrieve({ query: "test" });

    expect(result.documents).toHaveLength(2);
    const first = result.documents[0];
    expect(first?.chunkId).toBe("chunk-A");
    expect(first?.documentId).toBe("doc-A");
    expect(first?.chunkIndex).toBe(1);
    expect(first?.chunkId).not.toBe(first?.documentId);
    expect(first?.title).toBe("Title of doc-A");
    expect(first?.content).toBe("Content of chunk-A");
    expect(first?.score).toBe(0.92);
  });

  it("returns empty documents when the RPC finds nothing (never forced)", async () => {
    store.search.mockResolvedValue([]);

    const result = await retriever.retrieve({ query: "unknown topic xyz" });

    expect(result.documents).toEqual([]);
    expect(result.totalFound).toBe(0);
    expect(result.embeddingAvailable).toBe(true);
  });

  it("returns empty result for blank queries without calling the store", async () => {
    const result = await retriever.retrieve({ query: "   " });

    expect(result.documents).toEqual([]);
    expect(result.embeddingAvailable).toBe(false);
    expect(store.search).not.toHaveBeenCalled();
  });

  it("reports embedding unavailability instead of throwing", async () => {
    store.search.mockRejectedValue(new Error("embedding provider offline"));

    const result = await retriever.retrieve({ query: "test" });

    expect(result.documents).toEqual([]);
    expect(result.embeddingAvailable).toBe(false);
  });

  it("propagates non-embedding retrieval errors", async () => {
    store.search.mockRejectedValue(new Error("database exploded"));

    await expect(retriever.retrieve({ query: "test" })).rejects.toThrow("database exploded");
  });

  it("forwards session/user context to the store", async () => {
    store.search.mockResolvedValue([]);

    await retriever.retrieve({ query: "test", sessionId: "sess-1", userId: "user-1" });

    expect(store.search).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ sessionId: "sess-1", userId: "user-1" }),
    );
  });

  it("uses central defaults when topK/threshold are omitted", async () => {
    store.search.mockResolvedValue([]);

    await retriever.retrieve({ query: "test" });

    expect(store.search).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        topK: EMBEDDING_CONFIG.defaultTopK,
        similarityThreshold: EMBEDDING_CONFIG.defaultThreshold,
      }),
    );
  });

  it("types KnowledgeDocument embeddings per chunk (no flat-vector trap)", () => {
    const doc: KnowledgeDocument = {
      id: "doc-1",
      title: "t",
      content: "a b",
      source: { type: "faq" },
      metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
      embeddings: [[0.1, 0.2]],
    };
    expect(doc.embeddings?.[0]).toEqual([0.1, 0.2]);
  });
});
