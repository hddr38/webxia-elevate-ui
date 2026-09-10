import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildAgentContext } from "../agent/context-builder";
import { RAGEngine } from "../rag/rag-engine";
import type { RetrievalResult, VectorStore } from "../rag/types";
import type { EmbeddingProvider } from "../embeddings";
import { EMBEDDING_CONFIG } from "../embeddings/config";
import { NvidiaProvider } from "../providers/nvidia";
import { eventBus } from "../events";

// getSupabaseAdmin() is evaluated as an argument of createMemoryService —
// stub it so no credential is ever required.
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({}),
}));

// Memory fully mocked: retrieval RAG is the only measured path here.
vi.mock("../memory/memory-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../memory/memory-service")>();
  return {
    ...original,
    createMemoryService: () => ({
      searchMemory: vi.fn().mockResolvedValue([]),
    }),
  };
});

/**
 * End-to-end regression (no real network): the exact production failure.
 * Retrieval finds the FAQ test chunk ("...démarre à 1234 euros."), the UI
 * citation derives from it, and the NVIDIA payload MUST carry the same
 * content in messages[0] ({ role: "system" }).
 */

const CHUNK_CONTENT =
  "# FAQ Test WebXIA\n\n## Tarifs test\nCe document de test indique que l'offre de test démarre à 1234 euros.";

function fakeEmbeddingProvider(): EmbeddingProvider {
  const dims = EMBEDDING_CONFIG.dimensions;
  return {
    id: "test",
    name: "Test Embedding",
    dimensions: dims,
    initialize: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn().mockResolvedValue(new Array(dims).fill(0.1)),
    batchEmbed: vi.fn().mockResolvedValue([new Array(dims).fill(0.1)]),
    isAvailable: vi.fn().mockReturnValue(true),
  };
}

function faqTestResult(): RetrievalResult[] {
  return [
    {
      chunk: {
        id: "chunk-faq-test",
        documentId: "doc-faq-test",
        chunkIndex: 0,
        content: CHUNK_CONTENT,
        metadata: { chunk_index: 0 },
      },
      document: {
        id: "doc-faq-test",
        title: "FAQ Test WebXIA",
        content: CHUNK_CONTENT,
        source: { type: "faq", path: "./knowledge/webxia-faq-test.md" },
        metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
      },
      score: 0.71,
      distance: 0.29,
    },
  ];
}

function fakeStore(results: RetrievalResult[]): VectorStore {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    store: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue(results),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe("RAG retrieval → system prompt → NVIDIA payload", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
    vi.unstubAllGlobals();
  });

  it("transmits the retrieved 1234-euros chunk in messages[0] as system", async () => {
    const engine = new RAGEngine(fakeEmbeddingProvider(), {}, fakeStore(faqTestResult()));
    const userMessage = "C'est quoi l'offre de test et son prix ?";

    const built = await buildAgentContext({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-rag-e2e",
      userMessage,
      ragEngine: engine,
    });

    // 1. Retrieval populated the agent context (citation source).
    expect(built.agentContext.rag.documents).toHaveLength(1);

    // 2. Full chunk content in the system prompt — no arbitrary cut.
    expect(built.systemPrompt).toContain(
      "Ce document de test indique que l'offre de test démarre à 1234 euros.",
    );

    // 3. Real provider mapping (fetch mocked): knowledge reaches NVIDIA.
    const provider = new NvidiaProvider();
    await provider.initialize({
      apiKey: "test-key",
      baseUrl: "https://test.api/v1",
      timeout: 30000,
      maxRetries: 2,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 1,
          model: "nvidia/nemotron-3-ultra-550b-a55b",
          choices: [
            { index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await provider.complete({
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      messages: built.agentContext.messages,
      systemPrompt: built.systemPrompt,
    });

    const init = fetchMock.mock.calls[0][1] as { body: string };
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string | null }>;
    };
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[0]?.content).toContain(
      "Ce document de test indique que l'offre de test démarre à 1234 euros.",
    );

    // 4. Citation/content coherence: every cited document's content was
    // actually transmitted to the LLM (no citation without content).
    for (const doc of built.agentContext.rag.documents) {
      expect(body.messages[0]?.content).toContain(doc.content);
    }
  });
});
