import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Retriever } from "../rag/retriever";
import type { RetrieveResult } from "../rag/retriever";
import { ContextBuilder } from "../rag/context-builder";
import { RAGEngine } from "../rag/rag-engine";
import type {
  VectorStore,
  SearchOptions,
  RetrievalResult,
  KnowledgeDocument,
  KnowledgeChunk,
} from "../rag/types";
import type { EmbeddingProvider } from "../embeddings";
import { EMBEDDING_CONFIG } from "../embeddings/config";
import type { DocumentMetadata, ScoredDocument, RetrievalStrategy } from "../contracts";

type MockVectorStore = VectorStore & {
  initialize: Mock<() => Promise<void>>;
  store: Mock<(documents: KnowledgeDocument[]) => Promise<void>>;
  search: Mock<(query: string, options?: SearchOptions) => Promise<RetrievalResult[]>>;
  delete: Mock<(documentId: string) => Promise<void>>;
  update: Mock<(document: KnowledgeDocument) => Promise<void>>;
  clear: Mock<() => Promise<void>>;
};

function createMockVectorStore(overrides: Partial<MockVectorStore> = {}): MockVectorStore {
  return {
    initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    store: vi.fn<(documents: KnowledgeDocument[]) => Promise<void>>().mockResolvedValue(undefined),
    search: vi
      .fn<(query: string, options?: SearchOptions) => Promise<RetrievalResult[]>>()
      .mockResolvedValue([]),
    delete: vi.fn<(documentId: string) => Promise<void>>().mockResolvedValue(undefined),
    update: vi.fn<(document: KnowledgeDocument) => Promise<void>>().mockResolvedValue(undefined),
    clear: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockMetadata(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
  return {
    createdAt: 0,
    updatedAt: 0,
    tags: [],
    locale: "fr",
    priority: 0,
    ...overrides,
  };
}

function createMockEmbeddingProvider(
  overrides: Partial<EmbeddingProvider> = {},
): EmbeddingProvider {
  return {
    id: "test",
    name: "Test Embedding",
    dimensions: EMBEDDING_CONFIG.dimensions,
    initialize: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn().mockResolvedValue(new Array(EMBEDDING_CONFIG.dimensions).fill(0.1)),
    batchEmbed: vi.fn().mockResolvedValue([new Array(EMBEDDING_CONFIG.dimensions).fill(0.1)]),
    isAvailable: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

function createMockRetrievalResult(docs: Partial<ScoredDocument>[] = []): RetrievalResult[] {
  return docs.map((d, i) => ({
    chunk: {
      id: `chunk-${i}`,
      documentId: `doc-${i}`,
      chunkIndex: 0,
      content: d.content ?? `Content ${i}`,
      embedding: new Array(EMBEDDING_CONFIG.dimensions).fill(0.1),
      metadata: d.metadata ?? {},
    },
    document: {
      id: `doc-${i}`,
      title: d.title ?? `Document ${i}`,
      content: d.content ?? `Content ${i}`,
      source: {
        type: "website",
        url: "https://example.com",
      },
      metadata: {
        author: "Test Author",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locale: "fr",
        priority: 0,
        ...d.metadata,
      },
    },
    score: d.score ?? 0.9 - i * 0.1,
    distance: 1 - (d.score ?? 0.9 - i * 0.1),
  }));
}

describe("Retriever", () => {
  let retriever: Retriever;
  let mockStore: ReturnType<typeof createMockVectorStore>;

  beforeEach(() => {
    mockStore = createMockVectorStore();
    retriever = new Retriever(mockStore);
  });

  it("returns empty result for empty query", async () => {
    const result = await retriever.retrieve({ query: "" });
    expect(result.documents).toHaveLength(0);
    expect(result.embeddingAvailable).toBe(false);
    expect(result.totalFound).toBe(0);
  });

  it("returns empty result for whitespace query", async () => {
    const result = await retriever.retrieve({ query: "   " });
    expect(result.documents).toHaveLength(0);
  });

  it("calls vector store search with correct options", async () => {
    const mockResults = createMockRetrievalResult([
      { title: "Doc 1", content: "Content 1", score: 0.9 },
      { title: "Doc 2", content: "Content 2", score: 0.8 },
    ]);
    mockStore.search.mockResolvedValue(mockResults);

    const result = await retriever.retrieve({
      query: "test query",
      topK: 3,
      similarityThreshold: 0.8,
      strategy: "semantic",
    });

    expect(mockStore.search).toHaveBeenCalledWith("test query", {
      topK: 3,
      similarityThreshold: 0.8,
      strategy: "semantic",
      sessionId: undefined,
      userId: undefined,
      metadataFilters: undefined,
    });

    expect(result.documents).toHaveLength(2);
    expect(result.documents[0].title).toBe("Doc 1");
    expect(result.documents[0].score).toBe(0.9);
    expect(result.embeddingAvailable).toBe(true);
  });

  it("returns retrieval time", async () => {
    mockStore.search.mockResolvedValue(createMockRetrievalResult([]));
    const result = await retriever.retrieve({ query: "test" });
    expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("falls back to alternative store on failure", async () => {
    const fallbackStore = createMockVectorStore({
      search: vi
        .fn()
        .mockResolvedValue(createMockRetrievalResult([{ title: "Fallback", score: 0.8 }])),
    });

    mockStore.search.mockRejectedValue(new Error("Primary failed"));

    const result = await retriever.retrieveWithFallback({ query: "test" }, fallbackStore);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].title).toBe("Fallback");
  });

  it("propagates error if no fallback provided", async () => {
    mockStore.search.mockRejectedValue(new Error("Primary failed"));

    await expect(retriever.retrieveWithFallback({ query: "test" })).rejects.toThrow(
      "Primary failed",
    );
  });
});

describe("ContextBuilder", () => {
  let builder: ContextBuilder;

  beforeEach(() => {
    builder = new ContextBuilder({
      maxContextTokens: 1000,
      maxDocuments: 3,
      includeScore: true,
      includeSource: true,
    });
  });

  it("builds context string from retrieve result", () => {
    const mockResult: RetrieveResult = {
      query: "test query",
      strategy: "semantic" as RetrievalStrategy,
      documents: [
        {
          id: "1",
          title: "Doc 1",
          content: "Content 1",
          source: { type: "website" as const, url: "https://example.com" },
          metadata: createMockMetadata({ author: "John" }),
          score: 0.9,
          distance: 0.1,
          chunkId: "chunk-1",
          chunkIndex: 0,
          documentId: "doc-1",
        },
      ],
      totalFound: 1,
      retrievalTimeMs: 10,
      embeddingAvailable: true,
    };

    const contextString = builder.buildContextString(mockResult);

    expect(contextString).toContain("Doc 1");
    expect(contextString).toContain("Content 1");
    expect(contextString).toContain("website");
    expect(contextString).toContain("https://example.com");
    expect(contextString).toContain("0.900");
  });

  it("limits documents to maxDocuments", () => {
    const mockResult: RetrieveResult = {
      query: "test",
      strategy: "semantic" as RetrievalStrategy,
      documents: Array.from({ length: 5 }, (_, i) => ({
        id: `chunk-${i}`,
        title: `Doc ${i}`,
        content: `Content ${i}`,
        source: { type: "website" as const },
        metadata: createMockMetadata(),
        score: 0.9 - i * 0.1,
        distance: 0.1 + i * 0.1,
        chunkId: `chunk-${i}`,
        chunkIndex: i,
        documentId: `doc-${i}`,
      })),
      totalFound: 5,
      retrievalTimeMs: 10,
      embeddingAvailable: true,
    };

    const context = builder.buildContext(mockResult);
    expect(context.documents).toHaveLength(3);
  });

  it("truncates context to token limit", () => {
    const longContent = "x".repeat(500);

    const mockResult: RetrieveResult = {
      query: "test",
      strategy: "semantic" as RetrievalStrategy,
      documents: [
        {
          id: "1",
          title: "Doc 1",
          content: longContent,
          source: { type: "website" as const },
          metadata: createMockMetadata(),
          score: 0.9,
          distance: 0.1,
          chunkId: "chunk-1",
          chunkIndex: 0,
          documentId: "doc-1",
        },
      ],
      totalFound: 1,
      retrievalTimeMs: 10,
      embeddingAvailable: true,
    };

    const contextString = builder.buildContextString(mockResult);
    const estimatedTokens = Math.ceil(contextString.length / 4);
    expect(estimatedTokens).toBeLessThanOrEqual(1000);
  });

  it("can exclude score and source", () => {
    const builderNoMeta = new ContextBuilder({ includeScore: false, includeSource: false });

    const mockResult: RetrieveResult = {
      query: "test",
      strategy: "semantic" as RetrievalStrategy,
      documents: [
        {
          id: "1",
          title: "Doc 1",
          content: "Content 1",
          source: { type: "website" as const, url: "https://example.com" },
          metadata: createMockMetadata(),
          score: 0.9,
          distance: 0.1,
          chunkId: "chunk-1",
          chunkIndex: 0,
          documentId: "doc-1",
        },
      ],
      totalFound: 1,
      retrievalTimeMs: 10,
      embeddingAvailable: true,
    };

    const contextString = builderNoMeta.buildContextString(mockResult);
    expect(contextString).not.toContain("0.900");
    expect(contextString).not.toContain("https://example.com");
  });

  it("builds RAGContext with correct structure", () => {
    const mockResult: RetrieveResult = {
      query: "test query",
      strategy: "semantic" as RetrievalStrategy,
      documents: [
        {
          id: "1",
          title: "Doc 1",
          content: "Content 1",
          source: { type: "website" as const },
          metadata: createMockMetadata(),
          score: 0.9,
          distance: 0.1,
          chunkId: "chunk-1",
          chunkIndex: 0,
          documentId: "doc-1",
        },
      ],
      totalFound: 1,
      retrievalTimeMs: 10,
      embeddingAvailable: true,
    };

    const context = builder.buildContext(mockResult);

    expect(context.query).toBe("test query");
    expect(context.strategy).toBe("semantic");
    expect(context.documents).toHaveLength(1);
    expect(context.documents[0].title).toBe("Doc 1");
  });

  it("allows updating options", () => {
    builder.setOptions({ maxDocuments: 10, maxContextTokens: 8000 });
    const options = builder.getOptions();
    expect(options.maxDocuments).toBe(10);
    expect(options.maxContextTokens).toBe(8000);
  });
});

describe("RAGEngine", () => {
  let engine: RAGEngine;
  let mockEmbeddingProvider: ReturnType<typeof createMockEmbeddingProvider>;
  let mockVectorStore: ReturnType<typeof createMockVectorStore>;

  beforeEach(() => {
    mockEmbeddingProvider = createMockEmbeddingProvider();
    mockVectorStore = createMockVectorStore({
      initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    });

    engine = new RAGEngine(
      mockEmbeddingProvider,
      {
        topK: 3,
        similarityThreshold: 0.75,
        maxContextTokens: 2000,
      },
      mockVectorStore,
    );
  });

  function createMockEmbeddingProvider(
    overrides: Partial<EmbeddingProvider> = {},
  ): EmbeddingProvider {
    return {
      id: "test",
      name: "Test Embedding",
      dimensions: EMBEDDING_CONFIG.dimensions,
      initialize: vi.fn().mockResolvedValue(undefined),
      embed: vi.fn().mockResolvedValue(new Array(EMBEDDING_CONFIG.dimensions).fill(0.1)),
      batchEmbed: vi.fn().mockResolvedValue([new Array(EMBEDDING_CONFIG.dimensions).fill(0.1)]),
      isAvailable: vi.fn().mockReturnValue(true),
      ...overrides,
    };
  }

  it("initializes vector store on first query", async () => {
    mockVectorStore.search.mockResolvedValue([]);

    await engine.query("test query");

    expect(mockVectorStore.initialize).toHaveBeenCalled();
    expect(mockVectorStore.search).toHaveBeenCalled();
  });

  it("returns empty context when no results", async () => {
    mockVectorStore.search.mockResolvedValue([]);

    const result = await engine.query("test query");

    expect(result.retrieveResult.documents).toHaveLength(0);
    expect(result.contextString).toBe("");
    expect(result.context.documents).toHaveLength(0);
  });

  it("builds context string from results", async () => {
    const mockResults = createMockRetrievalResult([
      { title: "Doc 1", content: "Content about WebXIA services", score: 0.9 },
    ]);
    mockVectorStore.search.mockResolvedValue(mockResults);

    const result = await engine.query("WebXIA services");

    expect(result.contextString).toContain("Doc 1");
    expect(result.contextString).toContain("WebXIA services");
    expect(result.retrieveResult.embeddingAvailable).toBe(true);
  });

  it("respects topK and similarityThreshold from config", async () => {
    mockVectorStore.search.mockResolvedValue([]);

    await engine.query("test", { topK: 10, similarityThreshold: 0.5 });

    expect(mockVectorStore.search).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        topK: 10,
        similarityThreshold: 0.5,
      }),
    );
  });

  it("allows overriding config per query", async () => {
    mockVectorStore.search.mockResolvedValue([]);

    await engine.query("test", { topK: 1, similarityThreshold: 0.9 });

    expect(mockVectorStore.search).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        topK: 1,
        similarityThreshold: 0.9,
      }),
    );
  });

  it("passes sessionId and userId to retriever", async () => {
    mockVectorStore.search.mockResolvedValue([]);

    await engine.query("test", { sessionId: "sess-1", userId: "user-1" });

    expect(mockVectorStore.search).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        sessionId: "sess-1",
        userId: "user-1",
      }),
    );
  });

  it("passes metadata filters", async () => {
    mockVectorStore.search.mockResolvedValue([]);

    await engine.query("test", { metadataFilters: { locale: "en", tag: "pricing" } });

    expect(mockVectorStore.search).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        metadataFilters: { locale: "en", tag: "pricing" },
      }),
    );
  });

  it("returns retrieve time and embedding availability", async () => {
    mockVectorStore.search.mockResolvedValue(
      createMockRetrievalResult([{ title: "Doc 1", score: 0.9 }]),
    );

    const result = await engine.query("test");

    expect(result.retrieveResult.retrievalTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.retrieveResult.embeddingAvailable).toBe(true);
  });

  it("handles embedding provider failure gracefully", async () => {
    mockVectorStore.search.mockRejectedValue(new Error("Embedding failed"));

    await expect(engine.query("test")).rejects.toThrow("Embedding failed");
  });

  it("allows config updates", () => {
    engine.updateConfig({ topK: 10, maxDocuments: 10 });
    const config = engine.getConfig();
    expect(config.topK).toBe(10);
    expect(config.maxDocuments).toBe(10);
  });

  it("exposes embedding provider", () => {
    expect(engine.getEmbeddingProvider()).toBe(mockEmbeddingProvider);
  });
});
