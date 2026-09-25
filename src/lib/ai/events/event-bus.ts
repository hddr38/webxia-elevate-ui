export type WebiEventMap = {
  "agent.message.received": { sessionId: string; role: string };
  "agent.context.built": { sessionId: string; historyCount: number; memoryCount: number };
  "agent.llm.started": { model: string };
  "agent.llm.completed": {
    model: string;
    durationMs: number;
    /** Thinking deltas observed on the stream (reasoning models). */
    reasoningChunks?: number;
  };
  "agent.tool.started": { toolName: string };
  "agent.tool.completed": { toolName: string; durationMs: number; success: boolean };
  "agent.memory.created": { memoryId: string };
  "agent.response.completed": { durationMs: number };
  "agent.error": { stage: string; message: string };
  /** RAG retrieval started. No query/user content — lengths and bounds only. */
  "agent.rag.queried": {
    queryLength: number;
    topK: number;
    threshold: number;
    strategy: string;
  };
  /** RAG retrieval finished. Document ids and scores only, never contents. */
  "agent.rag.completed": {
    results: number;
    totalFound: number;
    topScore: number;
    documentIds: string[];
    retrievalMs: number;
    embeddingMs: number;
  };
  /** RAG retrieval failed (chat continues without knowledge). */
  "agent.rag.failed": { stage: "embedding" | "retrieval"; code: string };
};

export type WebiEventType = keyof WebiEventMap;

export interface WebiEvent<K extends WebiEventType> {
  type: K;
  /** ISO 8601 */
  timestamp: string;
  requestId: string;
  payload: WebiEventMap[K];
}

export type WebiEventListener<K extends WebiEventType> = (event: WebiEvent<K>) => void;

export interface EventBus {
  emit<K extends WebiEventType>(type: K, requestId: string, payload: WebiEventMap[K]): void;
  on<K extends WebiEventType>(type: K, listener: WebiEventListener<K>): () => void;
  once<K extends WebiEventType>(type: K, listener: WebiEventListener<K>): () => void;
  /**
   * System listeners only (audit, debug) — never business flow.
   * Receives every event; must stay side-effect-light and non-throwing.
   */
  onAny(listener: (event: WebiEvent<WebiEventType>) => void): () => void;
  /** Test/support helper: drop all listeners. */
  clear(): void;
}

type AnyListener = (event: WebiEvent<WebiEventType>) => void;

class InProcessEventBus implements EventBus {
  private handlers = new Map<WebiEventType, Set<AnyListener>>();
  private anyHandlers = new Set<AnyListener>();

  emit<K extends WebiEventType>(type: K, requestId: string, payload: WebiEventMap[K]): void {
    const event: WebiEvent<K> = {
      type,
      timestamp: new Date().toISOString(),
      requestId,
      payload,
    };

    const invoke = (listener: AnyListener) => {
      try {
        // Synchronous listeners only. A returned Promise (misuse) is
        // deliberately ignored: emit never fails and never awaits.
        (listener as (event: WebiEvent<K>) => void)(event);
      } catch (err) {
        // Isolation: log type + requestId only (payloads may carry user
        // content), keep the other listeners and the caller running.
        // The bus itself never emits from here, so an agent.error listener
        // failure cannot cascade into a new emission.
        console.error(`[EventBus] Listener error for ${type} (request ${requestId}):`, err);
      }
    };

    this.handlers.get(type)?.forEach(invoke);
    this.anyHandlers.forEach(invoke);
  }

  on<K extends WebiEventType>(type: K, listener: WebiEventListener<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const stored = listener as AnyListener;
    set.add(stored);
    return () => {
      set?.delete(stored);
    };
  }

  once<K extends WebiEventType>(type: K, listener: WebiEventListener<K>): () => void {
    const unsub = this.on(type, (event) => {
      unsub();
      listener(event);
    });
    return unsub;
  }

  onAny(listener: (event: WebiEvent<WebiEventType>) => void): () => void {
    this.anyHandlers.add(listener);
    return () => {
      this.anyHandlers.delete(listener);
    };
  }

  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}

export function createEventBus(): EventBus {
  return new InProcessEventBus();
}

/** Default module-level instance. */
export const eventBus: EventBus = createEventBus();

/**
 * System debug listener (reserved onAny usage): logs type + requestId only,
 * never payloads, so no user content or secret can leak into logs.
 */
export function createEventLogger(): () => void {
  return eventBus.onAny((event) => {
    console.log(`[EventBus] ${event.type} (request ${event.requestId})`);
  });
}
