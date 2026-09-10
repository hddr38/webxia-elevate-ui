import type { ScoredDocument } from "../contracts";

/**
 * Reranker abstraction (design seam for a future reranking stage).
 *
 * Pipeline position: Retriever results -> Reranker.rerank -> ContextBuilder.
 * This iteration ships NO external reranking service: DefaultReranker is a
 * documented no-op that preserves score order. A future implementation
 * (cross-encoder, Cohere, …) only needs to implement this interface.
 */
export interface Reranker {
  readonly id: string;
  rerank(query: string, documents: ScoredDocument[], topK: number): Promise<ScoredDocument[]>;
}

/** Pass-through reranker: keeps RPC score order, enforces topK. */
export class NoOpReranker implements Reranker {
  readonly id = "noop";

  async rerank(
    _query: string,
    documents: ScoredDocument[],
    topK: number,
  ): Promise<ScoredDocument[]> {
    return documents.slice(0, Math.max(1, topK));
  }
}
