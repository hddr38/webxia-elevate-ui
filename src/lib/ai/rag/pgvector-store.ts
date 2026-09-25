import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { VectorStore, SearchOptions, KnowledgeDocument, RetrievalResult } from "./types";
import type { EmbeddingProvider } from "../embeddings";
import { createKnowledgeRepository, type KnowledgeMatch } from "./repository";
import { chunkText } from "./chunker";
import { assertEmbeddingDimensions } from "../embeddings/config";
import { ProviderError } from "../providers/errors";

/**
 * pgvector-backed VectorStore. Thin compatibility façade over
 * KnowledgeRepository (the ONLY module that talks to Supabase for RAG).
 *
 * Vector search runs INSIDE Postgres via match_knowledge_chunks
 * (threshold + topK + filters). The former application-side pattern
 * (fetch topK*3 rows, cosine in Node.js) no longer exists.
 */
export class PgVectorStore implements VectorStore {
  private embeddingProvider: EmbeddingProvider;
  private initialized = false;

  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  async initialize(): Promise<void> {
    if (!this.embeddingProvider.isAvailable()) {
      await this.embeddingProvider.initialize({
        apiKey: "",
        baseUrl: "",
        timeout: 30000,
        maxRetries: 2,
      });
    }
    this.initialized = true;
  }

  async store(documents: KnowledgeDocument[]): Promise<void> {
    if (!this.initialized) await this.initialize();

    const repository = createKnowledgeRepository(getSupabaseAdmin());

    for (const doc of documents) {
      // Idempotent re-store with stable ids: wipe then recreate.
      await repository.deleteDocument(doc.id).catch(() => undefined);
      const documentId = await this.insertDocument(repository, doc);

      if (doc.embeddings && doc.embeddings.length > 0) {
        const chunks = chunkText(doc.content);
        if (chunks.length !== doc.embeddings.length) {
          throw new ProviderError(
            `Chunk count (${chunks.length}) doesn't match embedding count (${doc.embeddings.length})`,
            "INVALID_REQUEST",
            "pgvector",
            false,
          );
        }
        const chunkInputs = chunks.map((content, index) => {
          const embedding = doc.embeddings?.[index];
          if (!embedding) {
            throw new ProviderError(
              `Missing embedding for chunk ${index} of document ${doc.id}`,
              "INVALID_REQUEST",
              "pgvector",
              false,
            );
          }
          assertEmbeddingDimensions(embedding);
          return {
            chunkIndex: index,
            content,
            embedding,
            metadata: { ...doc.metadata, chunk_index: index },
          };
        });
        await repository.createChunks(documentId, chunkInputs);
      }
    }
  }

  private async insertDocument(
    repository: ReturnType<typeof createKnowledgeRepository>,
    doc: KnowledgeDocument,
  ): Promise<string> {
    try {
      const stored = await repository.createDocument({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        source: doc.source,
        metadata: doc.metadata,
      });
      return stored.id;
    } catch (error) {
      throw new ProviderError(
        `Failed to store document ${doc.id}: ${error instanceof Error ? error.message : "unknown"}`,
        "INVALID_REQUEST",
        "pgvector",
        false,
        { docId: doc.id },
      );
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<RetrievalResult[]> {
    if (!this.initialized) await this.initialize();

    const topK = options.topK ?? 5;
    const threshold = options.similarityThreshold ?? 0.7;

    const queryEmbedding = await this.measureEmbedding(query, options.onEmbeddingMeasured);
    assertEmbeddingDimensions(queryEmbedding);

    const repository = createKnowledgeRepository(getSupabaseAdmin());

    let matches: KnowledgeMatch[];
    try {
      matches = await repository.searchChunks({
        embedding: queryEmbedding,
        topK,
        threshold,
        locale: options.locale,
        sourceType: options.sourceType,
      });
    } catch (error) {
      throw new ProviderError(
        `Search failed: ${error instanceof Error ? error.message : "unknown"}`,
        "INVALID_REQUEST",
        "pgvector",
        true,
        { error: error instanceof Error ? error.message : "unknown" },
      );
    }

    return matches.map((match) => ({
      chunk: {
        id: match.chunkId,
        documentId: match.documentId,
        chunkIndex: match.chunkIndex,
        content: match.chunkContent,
        embedding: undefined,
        metadata: match.chunkMetadata,
      },
      document: {
        id: match.documentId,
        title: match.documentTitle,
        content: match.chunkContent,
        source: match.source,
        metadata: match.documentMetadata,
      },
      score: match.similarity,
      distance: 1 - match.similarity,
    }));
  }

  private async measureEmbedding(
    query: string,
    onMeasured?: (durationMs: number) => void,
  ): Promise<number[]> {
    const start = Date.now();
    try {
      return await this.embeddingProvider.embed(query);
    } finally {
      onMeasured?.(Date.now() - start);
    }
  }

  async delete(documentId: string): Promise<void> {
    const repository = createKnowledgeRepository(getSupabaseAdmin());
    await repository.deleteDocument(documentId);
  }

  async update(document: KnowledgeDocument): Promise<void> {
    await this.delete(document.id);
    await this.store([document]);
  }

  async clear(): Promise<void> {
    const repository = createKnowledgeRepository(getSupabaseAdmin());
    const { data } = await repository.listDocuments({}, 100, 0);
    for (const doc of data) {
      await repository.deleteDocument(doc.id);
    }
  }
}
