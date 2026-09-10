import { EmbeddingProvider } from "../embeddings";
import { EMBEDDING_CONFIG } from "../embeddings/config";
import type { VectorStore } from "./types";
import { PgVectorStore } from "./pgvector-store";
import { Retriever, RetrieveOptions, RetrieveResult } from "./retriever";
import { ContextBuilder } from "./context-builder";
import { NoOpReranker, type Reranker } from "./reranker";
import { eventBus } from "../events";
import type { RAGContext, RetrievalStrategy, ScoredDocument } from "../contracts";
import { ProviderError, ProviderErrorCode } from "../providers/errors";

export interface RAGEngineConfig {
  topK?: number;
  similarityThreshold?: number;
  maxContextTokens?: number;
  maxDocuments?: number;
  defaultStrategy?: RetrievalStrategy;
}

export interface RAGQueryOptions extends Partial<RetrieveOptions> {
  /** Correlation id for agent.rag.* telemetry. Omitted -> no events. */
  requestId?: string;
}

export interface RAGQueryResult {
  context: RAGContext;
  contextString: string;
  retrieveResult: RetrieveResult;
}

/**
 * Built knowledge context: the KNOWLEDGE slice of the agent context.
 * Deterministic, token-budgeted, citation-ready.
 */
export interface BuiltKnowledgeContext {
  chunks: ScoredDocument[];
  count: number;
  topScore: number;
  contextString: string;
  truncated: boolean;
}

export class RAGEngine {
  private vectorStore: VectorStore;
  private retriever: Retriever;
  private contextBuilder: ContextBuilder;
  private reranker: Reranker;
  private config: Required<RAGEngineConfig>;
  private initialized = false;
  private embeddingProvider: EmbeddingProvider;

  constructor(
    embeddingProvider: EmbeddingProvider,
    config: RAGEngineConfig = {},
    vectorStore?: VectorStore,
    reranker?: Reranker,
  ) {
    this.embeddingProvider = embeddingProvider;
    this.vectorStore = vectorStore ?? new PgVectorStore(embeddingProvider);
    this.retriever = new Retriever(this.vectorStore);
    this.reranker = reranker ?? new NoOpReranker();
    this.contextBuilder = new ContextBuilder({
      maxContextTokens: config.maxContextTokens,
      maxDocuments: config.maxDocuments,
    });

    this.config = {
      topK: config.topK ?? EMBEDDING_CONFIG.defaultTopK,
      similarityThreshold: config.similarityThreshold ?? EMBEDDING_CONFIG.defaultThreshold,
      maxContextTokens: config.maxContextTokens ?? 4000,
      maxDocuments: config.maxDocuments ?? 5,
      defaultStrategy: config.defaultStrategy ?? "semantic",
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.vectorStore.initialize();
    this.initialized = true;
  }

  async query(query: string, options: RAGQueryOptions = {}): Promise<RAGQueryResult> {
    if (!this.initialized) await this.initialize();

    const topK = options.topK ?? this.config.topK;
    const similarityThreshold = options.similarityThreshold ?? this.config.similarityThreshold;
    const strategy = options.strategy ?? this.config.defaultStrategy;
    const { requestId, ...retrieveOptions } = options;

    if (requestId) {
      eventBus.emit("agent.rag.queried", requestId, {
        queryLength: query.length,
        topK,
        threshold: similarityThreshold,
        strategy,
      });
    }

    let embeddingMs = 0;
    let retrieveResult: RetrieveResult;
    try {
      const retrieveOpts: RetrieveOptions = {
        ...retrieveOptions,
        query,
        topK,
        similarityThreshold,
        strategy,
        onEmbeddingMeasured: (ms: number) => {
          embeddingMs = ms;
        },
      };
      retrieveResult = await this.retriever.retrieve(retrieveOpts);
    } catch (error) {
      if (requestId) {
        eventBus.emit("agent.rag.failed", requestId, {
          stage:
            error instanceof Error && error.message.includes("embedding")
              ? "embedding"
              : "retrieval",
          code: error instanceof Error ? error.message.slice(0, 120) : "unknown",
        });
      }
      throw error;
    }

    // Rerank seam (no-op by default): preserves RPC score order, enforces topK.
    const reranked = await this.reranker.rerank(query, retrieveResult.documents, topK);
    const ranked: RetrieveResult = { ...retrieveResult, documents: reranked };

    const context = this.contextBuilder.buildContext(ranked);
    const contextString = this.contextBuilder.buildContextString(ranked);

    if (requestId) {
      eventBus.emit("agent.rag.completed", requestId, {
        results: reranked.length,
        totalFound: retrieveResult.totalFound,
        topScore: reranked[0]?.score ?? 0,
        documentIds: reranked.map((doc) => doc.documentId),
        retrievalMs: retrieveResult.retrievalTimeMs,
        embeddingMs,
      });
    }

    return { context, contextString, retrieveResult: ranked };
  }

  /** Builds the budgeted KNOWLEDGE slice (empty when nothing is pertinent). */
  buildKnowledgeContext(retrieveResult: RetrieveResult): BuiltKnowledgeContext {
    const contextString = this.contextBuilder.buildContextString(retrieveResult);
    const chunks = retrieveResult.documents;
    return {
      chunks,
      count: chunks.length,
      topScore: chunks[0]?.score ?? 0,
      contextString,
      truncated: chunks.length < retrieveResult.totalFound,
    };
  }

  async queryWithContextString(query: string, options: RAGQueryOptions = {}): Promise<string> {
    const result = await this.query(query, options);
    return result.contextString;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): Required<RAGEngineConfig> {
    return { ...this.config };
  }

  updateConfig(config: Partial<RAGEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.contextBuilder.setOptions({
      maxContextTokens: this.config.maxContextTokens,
      maxDocuments: this.config.maxDocuments,
    });
  }

  async storeDocuments(documents: Parameters<PgVectorStore["store"]>[0]): Promise<void> {
    if (!this.initialized) await this.initialize();
    await this.vectorStore.store(documents);
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    await this.vectorStore.delete(documentId);
  }

  async updateDocument(document: Parameters<PgVectorStore["update"]>[0]): Promise<void> {
    if (!this.initialized) await this.initialize();
    await this.vectorStore.update(document);
  }

  getEmbeddingProvider(): EmbeddingProvider {
    return this.embeddingProvider;
  }
}

export function createRAGEngine(
  embeddingProvider: EmbeddingProvider,
  config?: RAGEngineConfig,
): RAGEngine {
  return new RAGEngine(embeddingProvider, config);
}
