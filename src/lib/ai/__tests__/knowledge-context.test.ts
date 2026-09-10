import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildAgentContext, truncateContext } from "../agent/context-builder";
import { RAGEngine } from "../rag/rag-engine";
import type { RetrievalResult, VectorStore } from "../rag/types";
import type { EmbeddingProvider } from "../embeddings";
import { EMBEDDING_CONFIG } from "../embeddings/config";
import { eventBus } from "../events";
import { registerSkill, unregisterSkill } from "../skills/registry";
import { createSearchKnowledgeSkill } from "../skills/search-knowledge";
import type { AgentContext } from "../contracts";

// createMemoryService is fully mocked, but getSupabaseAdmin() is still
// evaluated as its argument — stub it so no credential is ever required.
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({}),
}));

// Memory is fully mocked: no Supabase client is ever touched here.
vi.mock("../memory/memory-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../memory/memory-service")>();
  return {
    ...original,
    createMemoryService: () => ({
      searchMemory: vi.fn().mockResolvedValue([]),
    }),
  };
});

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

function matchResult(): RetrievalResult[] {
  return [
    {
      chunk: {
        id: "chunk-3",
        documentId: "doc-3",
        chunkIndex: 1,
        content: "WebXIA crée des sites vitrines à partir de 5k euros.",
        metadata: { chunk_index: 1 },
      },
      document: {
        id: "doc-3",
        title: "Tarifs WebXIA",
        content: "WebXIA crée des sites vitrines à partir de 5k euros.",
        source: { type: "faq", url: "https://webxia.example/tarifs" },
        metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
      },
      score: 0.88,
      distance: 0.12,
    },
  ];
}

function fakeStore(results: RetrievalResult[] | Error): VectorStore {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    store: vi.fn().mockResolvedValue(undefined),
    search:
      results instanceof Error
        ? vi.fn().mockRejectedValue(results)
        : vi.fn().mockResolvedValue(results),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function baseOptions(ragEngine: RAGEngine) {
  return {
    conversationId: "conv-1",
    sessionId: "session-1",
    locale: "fr",
    requestId: "req-ctx",
    userMessage: "Quels sont vos tarifs ?",
    ragEngine,
  };
}

describe("knowledge context", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
    unregisterSkill("search_knowledge");
  });

  it("injects KNOWLEDGE only when retrieval finds pertinent documents", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore(matchResult()));

    const built = await buildAgentContext(baseOptions(engine));

    expect(built.agentContext.rag.documents).toHaveLength(1);
    expect(built.agentContext.rag.documents[0]).toMatchObject({
      documentId: "doc-3",
      chunkId: "chunk-3",
      chunkIndex: 1,
    });
    expect(built.systemPrompt).toContain("base de connaissances");
    expect(built.systemPrompt).toContain("Tarifs WebXIA");
    // Dynamic KNOWLEDGE block (budgeted RAG rendering, full chunk content).
    expect(built.systemPrompt).toContain("[DOCUMENT 1]");
    expect(built.systemPrompt).toContain("WebXIA crée des sites vitrines à partir de 5k euros.");
  });

  it("injects nothing when retrieval finds nothing (never forced)", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore([]));

    const built = await buildAgentContext(baseOptions(engine));

    expect(built.agentContext.rag.documents).toEqual([]);
    // No dynamic KNOWLEDGE block (the static Webi rules stay, data doesn't).
    expect(built.systemPrompt).not.toContain("[DOCUMENT");
  });

  it("survives retrieval failure and emits agent.rag.failed", async () => {
    const engine = new RAGEngine(
      fakeEmbeddingProvider(),
      {},
      fakeStore(new Error("database exploded")),
    );
    const failed: Array<{ stage: string; code: string }> = [];
    eventBus.on("agent.rag.failed", (event) => {
      failed.push(event.payload);
    });

    const built = await buildAgentContext(baseOptions(engine));

    expect(built.agentContext.rag.documents).toEqual([]);
    expect(built.systemPrompt).not.toContain("[DOCUMENT");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.stage).toBe("retrieval");
  });

  it("emits observable RAG telemetry without user or document content", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore(matchResult()));
    const seen: Array<{ type: string; payload: unknown }> = [];
    eventBus.onAny((event) => {
      seen.push({ type: event.type, payload: event.payload });
    });

    await buildAgentContext({ ...baseOptions(engine), requestId: "req-tel" });

    const queried = seen.find((e) => e.type === "agent.rag.queried");
    const completed = seen.find((e) => e.type === "agent.rag.completed");
    expect(queried?.payload).toMatchObject({ topK: 5, threshold: 0.7, strategy: "semantic" });
    expect(completed?.payload).toMatchObject({
      results: 1,
      totalFound: 1,
      topScore: 0.88,
      documentIds: ["doc-3"],
    });
    // Hygiene: no query text, no chunk content anywhere in telemetry.
    const serialized = JSON.stringify(seen);
    expect(serialized).not.toContain("Quels sont vos tarifs");
    expect(serialized).not.toContain("vitrines");
  });

  it("never exposes search_knowledge as a chat tool", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore([]));
    registerSkill(createSearchKnowledgeSkill(engine));

    const built = await buildAgentContext(baseOptions(engine));
    const names = built.availableTools.map((tool) => tool.function.name);

    expect(names).not.toContain("search_knowledge");
  });

  it("does not duplicate the user message already present in history", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore([]));
    const userMessage = "Bonjour";
    const history = [{ id: "m1", role: "user" as const, content: userMessage, timestamp: 1 }];

    const built = await buildAgentContext({
      ...baseOptions(engine),
      userMessage,
      conversationHistory: history,
    });

    expect(built.agentContext.messages).toHaveLength(1);
  });

  it("appends the user message when history does not contain it", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore([]));

    const built = await buildAgentContext({
      ...baseOptions(engine),
      conversationHistory: [],
    });

    expect(built.agentContext.messages).toHaveLength(1);
    expect(built.agentContext.messages[0]).toMatchObject({ role: "user" });
  });

  it("expands short follow-ups with the prior user message for retrieval", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore(matchResult()));
    const priorQuestion = "Quels sont vos tarifs pour un site vitrine ?";

    const built = await buildAgentContext({
      ...baseOptions(engine),
      userMessage: "répond",
      conversationHistory: [
        { id: "m1", role: "user" as const, content: priorQuestion, timestamp: 1 },
        { id: "m2", role: "assistant" as const, content: "", timestamp: 2 },
      ],
    });

    // Retrieval kept the thread topic instead of querying "répond" alone.
    expect(built.agentContext.rag.query).toContain(priorQuestion);
    expect(built.agentContext.rag.query).toContain("répond");
  });

  it("queries substantive messages as-is (no history prefix)", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore(matchResult()));
    const userMessage = "C'est quoi l'offre de test et son prix ?";

    const built = await buildAgentContext({
      ...baseOptions(engine),
      userMessage,
      conversationHistory: [{ id: "m1", role: "user" as const, content: "Bonjour", timestamp: 1 }],
    });

    expect(built.agentContext.rag.query).toBe(userMessage);
  });
});

describe("truncateContext priority", () => {
  function bigContext(): AgentContext {
    return {
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      systemPrompt: "SYS",
      messages: Array.from({ length: 6 }, (_, i) => ({
        id: `m${i}`,
        role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content: `message ${i} `.repeat(50),
        timestamp: i,
      })),
      memory: {
        conversation: [],
        session: {
          sessionId: "session-1",
          startedAt: 0,
          lastActivity: 0,
          pageViews: 0,
          messagesCount: 6,
          locale: "fr",
        },
        summaries: [
          {
            conversationId: "old",
            summary: "old summary ".repeat(50),
            keyPoints: [],
            topics: [],
            sentiment: "neutral" as const,
            generatedAt: 0,
          },
        ],
        history: [],
      },
      rag: {
        documents: Array.from({ length: 4 }, (_, i) => ({
          id: `chunk-${i}`,
          title: `Doc ${i}`,
          content: `content ${i} `.repeat(60),
          source: { type: "faq" as const },
          metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
          score: 0.9,
          distance: 0.1,
          chunkId: `chunk-${i}`,
          chunkIndex: i,
          documentId: `doc-${i}`,
        })),
        query: "q",
        strategy: "semantic" as const,
      },
      availableTools: [
        {
          type: "function" as const,
          function: {
            name: "tool-a",
            description: "d ".repeat(100),
            parameters: {},
          },
        },
      ],
    };
  }

  it("keeps the system prompt and recent messages while cutting knowledge first", () => {
    const truncated = truncateContext(bigContext(), 1200);
    const payload = truncated satisfies AgentContext;

    expect(payload.systemPrompt).toBe("SYS");
    // Knowledge is dropped before recent messages disappear entirely.
    expect(payload.rag.documents.length).toBeLessThan(4);
    expect(payload.messages.length).toBeGreaterThanOrEqual(1);
    // The most recent message survives (messages are shifted from the front).
    expect(payload.messages[payload.messages.length - 1]?.id).toBe("m5");
  });

  it("strips memory summaries only when still over budget", () => {
    const truncated = truncateContext(bigContext(), 300);

    expect(truncated.systemPrompt).toBe("SYS");
    expect(truncated.memory.summaries).toEqual([]);
    expect(truncated.rag.documents).toEqual([]);
  });
});
