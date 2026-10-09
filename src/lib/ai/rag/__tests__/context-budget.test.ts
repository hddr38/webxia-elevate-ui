import { describe, it, expect, vi } from "vitest";
import { RAGEngine } from "../rag-engine";
import { ContextBuilder } from "../context-builder";
import type { RetrieveResult } from "../retriever";
import type { ScoredDocument } from "../../contracts";
import type { EmbeddingProvider } from "../../embeddings";
import type { VectorStore } from "../types";

/**
 * Budget de contexte RAG (maxContextTokens).
 *
 * Contexte : `ContextBuilder.buildContext()` calcule `finalContext` via
 * `truncateToTokenLimit()` mais ne le retourne jamais (`RAGContext` n'a
 * aucun champ texte) ; le chemin live (`buildKnowledgeContext()` ->
 * `buildContextString()`) ne tronque pas. Voir revue D/RAG.
 */

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function makeDoc(index: number, contentChars: number): ScoredDocument {
  return {
    id: `chunk-${index}`,
    title: `Doc ${index}`,
    content: "x".repeat(contentChars),
    source: { type: "website", url: "https://example.com" },
    metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
    score: 0.9 - index * 0.01,
    distance: 0.1,
    chunkId: `chunk-${index}`,
    chunkIndex: index,
    documentId: `doc-${index}`,
  };
}

function makeRetrieveResult(docCount: number, contentChars: number): RetrieveResult {
  const documents = Array.from({ length: docCount }, (_, i) => makeDoc(i, contentChars));
  return {
    query: "test query",
    strategy: "semantic",
    documents,
    totalFound: documents.length,
    retrievalTimeMs: 10,
    embeddingAvailable: true,
  };
}

function createMockEmbeddingProvider(): EmbeddingProvider {
  return {
    id: "test",
    name: "Test Embedding",
    dimensions: 2048,
    initialize: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn().mockResolvedValue(new Array(2048).fill(0.1)),
    batchEmbed: vi.fn().mockResolvedValue([new Array(2048).fill(0.1)]),
    abort: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(true),
  };
}

function createMockVectorStore(): VectorStore {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    store: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function createEngine(maxContextTokens: number, maxDocuments: number): RAGEngine {
  return new RAGEngine(
    createMockEmbeddingProvider(),
    { maxContextTokens, maxDocuments },
    createMockVectorStore(),
  );
}

describe("RAG context budget", () => {
  it("cas 1 — sous le budget : contenu intact, truncated faux", () => {
    const engine = createEngine(4000, 5);
    const result = makeRetrieveResult(2, 200);

    const built = engine.buildKnowledgeContext(result);

    expect(built.count).toBe(2);
    expect(built.contextString).toContain("Doc 0");
    expect(built.contextString).toContain("Doc 1");
    expect(built.truncated).toBe(false);
    expect(estimateTokens(built.contextString)).toBeLessThanOrEqual(4000);
  });

  it("cas 2 — au-dessus du budget : contexte budgété, truncated vrai", () => {
    const engine = createEngine(500, 10);
    const result = makeRetrieveResult(5, 3000);

    const built = engine.buildKnowledgeContext(result);

    expect(estimateTokens(built.contextString)).toBeLessThanOrEqual(500);
    expect(built.truncated).toBe(true);
  });

  it("cas 3b — buildContext ne retourne aucun texte (chemin legacy non live)", () => {
    // `finalContext` reste calculé mais non retourné par `buildContext()`
    // (`RAGContext` n'a aucun champ texte) ; le chemin live passe par
    // `buildBudgetedContextString()`. Conservé comme garde-fou de forme.
    const builder = new ContextBuilder({ maxContextTokens: 500, maxDocuments: 10 });
    const result = makeRetrieveResult(5, 3000);

    const context = builder.buildContext(result);

    expect("contextString" in context).toBe(false);
    expect(Object.keys(context).sort()).toEqual(["documents", "query", "strategy"]);
  });

  it("cas 3c — truncated reflète la troncature réelle, pas la pagination", () => {
    // Même avec plus de documents trouvés que rendus, pas de troncature
    // sous le budget : `truncated` reste faux.
    const engine = createEngine(4000, 5);
    const result = { ...makeRetrieveResult(2, 200), totalFound: 10 };

    const built = engine.buildKnowledgeContext(result);

    expect(built.truncated).toBe(false);
    expect(estimateTokens(built.contextString)).toBeLessThanOrEqual(4000);
  });
});
