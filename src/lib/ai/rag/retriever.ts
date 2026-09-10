import type { VectorStore, SearchOptions } from "./types";
import type { ScoredDocument, RetrievalStrategy } from "../contracts";
import { clampThreshold, clampTopK } from "../embeddings/config";

export interface RetrieveOptions extends SearchOptions {
  query: string;
  topK?: number;
  similarityThreshold?: number;
  strategy?: RetrievalStrategy;
  sessionId?: string;
  userId?: string;
}

export interface RetrieveResult {
  query: string;
  strategy: RetrievalStrategy;
  documents: ScoredDocument[];
  totalFound: number;
  retrievalTimeMs: number;
  embeddingAvailable: boolean;
}

/**
 * DB-first retriever. The vector search runs INSIDE Postgres
 * (match_knowledge_chunks via the VectorStore); this layer only bounds
 * parameters, maps rows to ScoredDocuments and keeps chunk/document
 * identities strictly separate (chunkId/chunkIndex/documentId).
 */
export class Retriever {
  private vectorStore: VectorStore;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  async retrieve(options: RetrieveOptions): Promise<RetrieveResult> {
    const startTime = Date.now();
    const { query, ...searchOptions } = options;
    const strategy = searchOptions.strategy ?? "semantic";

    if (!query || query.trim().length === 0) {
      return {
        query,
        strategy,
        documents: [],
        totalFound: 0,
        retrievalTimeMs: Date.now() - startTime,
        embeddingAvailable: false,
      };
    }

    try {
      const results = await this.vectorStore.search(query, {
        ...searchOptions,
        topK: clampTopK(options.topK),
        similarityThreshold: clampThreshold(options.similarityThreshold),
        strategy,
      });

      // Identities: chunk.id is the chunk scope (unique per chunk),
      // document.id is the document scope. Never conflated.
      const documents: ScoredDocument[] = results.map((r) => ({
        id: r.chunk.id,
        title: r.document.title,
        content: r.chunk.content,
        source: r.document.source,
        metadata: r.document.metadata,
        score: r.score,
        distance: r.distance,
        chunkId: r.chunk.id,
        chunkIndex: r.chunk.chunkIndex,
        documentId: r.document.id,
      }));

      return {
        query,
        strategy,
        documents,
        totalFound: results.length,
        retrievalTimeMs: Date.now() - startTime,
        embeddingAvailable: true,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("embedding")) {
        return {
          query,
          strategy,
          documents: [],
          totalFound: 0,
          retrievalTimeMs: Date.now() - startTime,
          embeddingAvailable: false,
        };
      }
      throw error;
    }
  }

  async retrieveWithFallback(
    options: RetrieveOptions,
    fallbackStore?: VectorStore,
  ): Promise<RetrieveResult> {
    try {
      return await this.retrieve(options);
    } catch (error) {
      if (fallbackStore && error instanceof Error) {
        const fallbackRetriever = new Retriever(fallbackStore);
        return fallbackRetriever.retrieve(options);
      }
      throw error;
    }
  }
}
