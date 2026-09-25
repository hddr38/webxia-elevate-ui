import { describe, it, expect, vi } from "vitest";
import { RAGEngine } from "../rag-engine";
import { Retriever } from "../retriever";
import { EMBEDDING_CONFIG } from "../../embeddings/config";
import type { EmbeddingProvider } from "../../embeddings";
import type { VectorStore, SearchOptions, RetrievalResult } from "../types";

const DIMS = EMBEDDING_CONFIG.dimensions;

function fakeEmbeddingProvider(): EmbeddingProvider {
  return {
    id: "test",
    name: "Test Embedding",
    dimensions: DIMS,
    initialize: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn().mockResolvedValue(new Array(DIMS).fill(0.1)),
    batchEmbed: vi.fn().mockResolvedValue([new Array(DIMS).fill(0.1)]),
    isAvailable: vi.fn().mockReturnValue(true),
  };
}

function fakeStore(): VectorStore & {
  search: ReturnType<typeof vi.fn>;
} {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    store: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([] as RetrievalResult[]),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function lastSearchOptions(store: { search: ReturnType<typeof vi.fn> }): SearchOptions {
  const calls = store.search.mock.calls as Array<[string, SearchOptions?]>;
  const options = calls[0]?.[1];
  if (!options) throw new Error("store.search was not called with options");
  return options;
}

describe("retrieval locale chain (LOT 2)", () => {
  // TEST 3: locale is preserved across
  // RAGEngine -> Retriever -> VectorStore (repository -> RPC is covered by
  // repository.test.ts "searchChunks calls the RPC with clamped params").
  it("preserves locale and sourceType from engine to store", async () => {
    const store = fakeStore();
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, store);

    await engine.query("Quels sont vos tarifs ?", { locale: "fr", sourceType: "faq" });

    expect(store.search).toHaveBeenCalledWith(
      "Quels sont vos tarifs ?",
      expect.objectContaining({ locale: "fr", sourceType: "faq" }),
    );
  });

  it("preserves locale through the retriever", async () => {
    const store = fakeStore();
    const retriever = new Retriever(store);

    await retriever.retrieve({ query: "How much?", locale: "en" });

    expect(store.search).toHaveBeenCalledWith(
      "How much?",
      expect.objectContaining({ locale: "en" }),
    );
  });

  // TEST 4: a declared supported filter is really applied (reaches the store).
  it("applies declared supported filters instead of dropping them", async () => {
    const store = fakeStore();
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, store);

    await engine.query("test", { locale: "en", sourceType: "blog" });

    const options = lastSearchOptions(store);
    expect(options.locale).toBe("en");
    expect(options.sourceType).toBe("blog");
    // No legacy catch-all filter key may travel alongside.
    expect(options).not.toHaveProperty("metadataFilters");
    expect(options).not.toHaveProperty("filters");
  });

  // TEST 6: behaviour without filters is unchanged.
  it("keeps unfiltered behaviour unchanged", async () => {
    const store = fakeStore();
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, store);

    const result = await engine.query("test");

    const options = lastSearchOptions(store);
    expect(options.locale).toBeUndefined();
    expect(options.sourceType).toBeUndefined();
    expect(options.topK).toBe(EMBEDDING_CONFIG.defaultTopK);
    expect(options.similarityThreshold).toBe(EMBEDDING_CONFIG.defaultThreshold);
    expect(result.retrieveResult.documents).toEqual([]);
    expect(result.retrieveResult.totalFound).toBe(0);
  });

  // TEST 7: topK and threshold keep being clamped along the chain.
  it("clamps topK and threshold before the store", async () => {
    const store = fakeStore();
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, store);

    await engine.query("test", { topK: 999, similarityThreshold: 5 });

    const options = lastSearchOptions(store);
    expect(options.topK).toBe(EMBEDDING_CONFIG.maxTopK);
    expect(options.similarityThreshold).toBe(1);
  });

  // TEST 8: no result still produces a clean empty retrieval.
  it("returns a clean empty retrieval when nothing matches", async () => {
    const store = fakeStore();
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, store);

    const result = await engine.query("test", { locale: "fr" });

    expect(result.retrieveResult.documents).toEqual([]);
    expect(result.retrieveResult.totalFound).toBe(0);
    expect(result.retrieveResult.embeddingAvailable).toBe(true);
    expect(result.contextString).toBe("");
  });
});
