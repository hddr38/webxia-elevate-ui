import { createServerFn } from "@tanstack/react-start";
import { eventBus } from "@/lib/ai/events";
import {
  ConversationNotFoundError,
  addMessage,
  getConversationHistory,
  getOrCreateConversation,
} from "@/lib/ai/conversation/conversation-service";
import { AgentOrchestrator, AgentRunResult } from "@/lib/ai/agent/orchestrator";
import { ModelRouter } from "@/lib/ai/providers/model-router";
import { NvidiaProvider } from "@/lib/ai/providers/nvidia";
import { RAGEngine } from "@/lib/ai/rag/rag-engine";
import type { SessionUser } from "@/lib/auth/session";
import { ChatMessageSchema } from "@/lib/ai/security/validation";
import { createSecurityMiddleware, addSecurityHeaders } from "@/lib/ai/security/middleware";
import type { ReadableStreamDefaultController } from "stream/web";
import type { Message } from "@/lib/ai/contracts";
import type { TypedStreamEvent, AgentErrorCode } from "@/lib/ai/contracts";

export function generateRequestId(): string {
  return crypto.randomUUID();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const chatSecurityMiddleware = createSecurityMiddleware({
  maxPayloadSize: 50000,
  enablePromptInjectionCheck: true,
});

const DEFAULT_CHAT_TIMEOUT_MS = 60_000;
const MIN_CHAT_TIMEOUT_MS = 5_000;
const MAX_CHAT_TIMEOUT_MS = 300_000;

export function resolveChatTimeoutMs(
  envValue: string | undefined = process.env.CHAT_REQUEST_TIMEOUT_MS,
): number {
  const parsed = Number(envValue);
  if (envValue === undefined || envValue.trim() === "" || !Number.isFinite(parsed)) {
    return DEFAULT_CHAT_TIMEOUT_MS;
  }
  return Math.min(MAX_CHAT_TIMEOUT_MS, Math.max(MIN_CHAT_TIMEOUT_MS, Math.floor(parsed)));
}

const DEFAULT_CHAT_HEARTBEAT_MS = 15_000;
const MIN_CHAT_HEARTBEAT_MS = 250;
const MAX_CHAT_HEARTBEAT_MS = 60_000;

/**
 * Idle gap between SSE keep-alive frames. Proxies/CDNs cut a connection that
 * stays silent while the model thinks (setup + RAG + TTFB can reach tens of
 * seconds). Emitted as an SSE comment (`: hb …`) so existing consumers that
 * only read `data: ` lines are untouched.
 */
export function resolveChatHeartbeatMs(
  envValue: string | undefined = process.env.CHAT_HEARTBEAT_MS,
): number {
  const parsed = Number(envValue);
  if (envValue === undefined || envValue.trim() === "" || !Number.isFinite(parsed)) {
    return DEFAULT_CHAT_HEARTBEAT_MS;
  }
  return Math.min(MAX_CHAT_HEARTBEAT_MS, Math.max(MIN_CHAT_HEARTBEAT_MS, Math.floor(parsed)));
}

function chatAbortError(kind: "timeout" | "disconnect"): Error & {
  code: AgentErrorCode;
  recoverable: boolean;
} {
  const error = new Error(
    kind === "timeout" ? "Chat request timed out" : "Chat request aborted",
  ) as Error & { code: AgentErrorCode; recoverable: boolean };
  error.code = kind === "timeout" ? "GLOBAL_TIMEOUT" : "INTERNAL_ERROR";
  error.recoverable = kind === "timeout";
  return error;
}

interface ChatLifecycle {
  readonly signal: AbortSignal;
  timedOut(): boolean;
  abort(reason: Error): void;
  cleanup(): void;
}

/**
 * One controller for the whole chat request: a configurable deadline plus
 * client-disconnect detection (request.signal). The orchestrator is raced
 * against it so a hung run can never outlive the HTTP request.
 */
function createChatLifecycle(request: Request, timeoutMs: number): ChatLifecycle {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(chatAbortError("timeout"));
  }, timeoutMs);
  const onClientAbort = () => {
    controller.abort(chatAbortError("disconnect"));
  };
  if (request.signal.aborted) {
    onClientAbort();
  } else {
    request.signal.addEventListener("abort", onClientAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    abort: (reason) => {
      if (!controller.signal.aborted) controller.abort(reason);
    },
    cleanup: () => {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onClientAbort);
    },
  };
}

export interface ChatHandlerContext {
  request: Request;
  user: SessionUser | null;
  sanitizedBody: Record<string, unknown>;
  requestId: string;
}

export async function handleChatRequest(ctx: ChatHandlerContext): Promise<Response> {
  const lifecycle = createChatLifecycle(ctx.request, resolveChatTimeoutMs());
  try {
    return await runChatRequest(ctx, lifecycle);
  } catch (error) {
    lifecycle.cleanup();
    throw error;
  }
}

async function runChatRequest(
  ctx: ChatHandlerContext,
  lifecycle: ChatLifecycle,
): Promise<Response> {
  const { request, user, sanitizedBody, requestId } = ctx;

  const sessionIdInput = sanitizedBody?.sessionId as string | undefined;
  const userId = user?.id;
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  // Strict anonymous Webi session check: present AND valid UUID.
  // sessionId is NOT an identity — ownership is verified explicitly below.
  if (!sessionIdInput || !UUID_RE.test(sessionIdInput)) {
    await import("@/lib/ai/security/audit-log").then(({ auditLogger }) =>
      auditLogger.logAuthFailure("unknown", "Missing or invalid session ID", {
        requestId,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
      }),
    );
    throw new Response("Unauthorized: No session", { status: 401 });
  }
  // Narrowed to `string` here so nested functions (the stream) see a defined
  // value too — control-flow narrowing does not survive into closures.
  const sessionId: string = sessionIdInput;

  const conversationId = sanitizedBody?.conversationId as string | undefined;
  const message = sanitizedBody?.message as string;
  const locale = (sanitizedBody?.locale as string) ?? "fr";
  const isRetry = sanitizedBody?.isRetry === true;

  eventBus.emit("agent.message.received", requestId, { sessionId, role: "user" });

  // Conversation resolution via the domain service (service-role inside,
  // session ownership enforced on every query). External contract preserved:
  // unknown-or-foreign conversationId → 403 + audit (never existence leak).
  // Malformed ids never reach here (Zod uuid validation → 400 upstream);
  // the UUID_RE guard below is defense-in-depth for direct callers.
  const convCtx = { sessionId, userId };
  let resolvedConversationId: string;
  let conversationHistory: Message[];

  try {
    if (conversationId && UUID_RE.test(conversationId)) {
      try {
        conversationHistory = await getConversationHistory(convCtx, conversationId, 50);
        resolvedConversationId = conversationId;
      } catch (error) {
        if (!(error instanceof ConversationNotFoundError)) throw error;
        await import("@/lib/ai/security/audit-log").then(({ auditLogger }) =>
          auditLogger.logSecurityEvent("permission_denied", {
            severity: "high",
            userId: userId,
            sessionId,
            conversationId,
            requestId,
            eventData: { reason: "Conversation session mismatch" },
            errorMessage: "Conversation session mismatch",
          }),
        );
        throw new Response("Forbidden: Session mismatch", { status: 403 });
      }
    } else {
      const conversation = await getOrCreateConversation(convCtx);
      resolvedConversationId = conversation.id;
      conversationHistory = await getConversationHistory(convCtx, resolvedConversationId, 50);
    }

    // A retry of a message the previous attempt already stored (the client
    // only knows a conversation id after message_start, which is emitted
    // after this write) must not duplicate the user turn. No known
    // conversation ⇒ we cannot prove the write happened, so we write it.
    if (!isRetry || !conversationId) {
      await addMessage(convCtx, resolvedConversationId, { role: "user", content: message });
    }
  } catch (error) {
    // Controlled HTTP flow (401/403 above) stays silent here — it is already
    // audit-logged. Unexpected failures are observable via the bus.
    if (!(error instanceof Response)) {
      eventBus.emit("agent.error", requestId, {
        stage: "chat",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    throw error;
  }

  // Deadline or client disconnect already hit during conversation setup —
  // fail before any provider call or stream starts.
  if (lifecycle.signal.aborted) {
    const timedOut = lifecycle.timedOut();
    throw new Response(timedOut ? "Gateway Timeout" : "Client Closed Request", {
      status: timedOut ? 504 : 499,
    });
  }

  const { NvidiaProvider } = await import("@/lib/ai/providers/nvidia");
  const { NvidiaEmbeddingProvider } = await import("@/lib/ai/embeddings/nvidia");
  const { ModelRouter } = await import("@/lib/ai/providers/model-router");
  const { RAGEngine } = await import("@/lib/ai/rag/rag-engine");
  const { AgentOrchestrator } = await import("@/lib/ai/agent/orchestrator");

  const nvidiaConfig = {
    apiKey: process.env.NVIDIA_NIM_API_KEY!,
    baseUrl: process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
    timeout: 120000,
    maxRetries: 2,
  };
  // LLM TTFB budget: must be < CHAT_REQUEST_TIMEOUT_MS (110s) or the
  // lifecycle kills the request before the provider can time out — and
  // fallback would never run. 45s ≫ normal nano-omni TTFB (0.2-3s).
  const llmConfig = { ...nvidiaConfig, timeout: 45000 };

  const nvidiaProvider = new NvidiaProvider();
  await nvidiaProvider.initialize(llmConfig);

  const embeddingProvider = new NvidiaEmbeddingProvider();
  await embeddingProvider.initialize(nvidiaConfig);

  // Model id must exist on the NIM account (verified via /v1/models).
  // Primary is Nano Omni (multimodal, reasoning) — prepares future voice /
  // image inputs; fallback is Lightning 30B (latency-optimized), used
  // automatically on TIMEOUT / 5xx / 429 (never on 4xx logic errors).
  const chatModel =
    process.env.NVIDIA_NIM_DEFAULT_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
  const fallbackModel =
    process.env.NVIDIA_NIM_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

  const modelRouter = new ModelRouter({
    primaryProvider: "nvidia",
    primaryModel: chatModel,
    fallbackProvider: "nvidia",
    fallbackModel,
    enableFallback: true,
  });
  modelRouter.register(nvidiaProvider);

  const ragEngine = new RAGEngine(embeddingProvider);

  const orchestrator = new AgentOrchestrator({
    // The router itself implements LLMProvider: fallback (nano-omni →
    // lightning) runs inside its complete()/stream() in production.
    llmProvider: modelRouter,
    ragEngine,
    config: { defaultModel: chatModel },
  });

  let streamCancelled = false;
  /** Content forwarded to the client as `text_delta` — kept for LOT 23. */
  let partialContent = "";
  let assistantPersisted = false;

  /**
   * Producer-side backpressure: the agent loop parks here while written frames
   * still wait for HTTP demand. Woken by a flush, by stream cancellation or by
   * the lifecycle deadline — never left hanging.
   */
  let pendingDrain: (() => void) | null = null;
  const wakeDrain = (): void => {
    const resolve = pendingDrain;
    pendingDrain = null;
    resolve?.();
  };

  const heartbeatMs = resolveChatHeartbeatMs();
  /** Installed by serveStream(); pull() and cancel() both drive it. */
  let pumpQueue: () => void = () => {};

  /**
   * Drives the whole SSE lifetime. It must NOT be awaited from start(): the
   * stream only calls pull() once start() has resolved, and pull() is what
   * releases frames queued when the consumer was not ready.
   */
  async function serveStream(
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    let closed = false;
    /** Production is over but frames may still be waiting for HTTP demand. */
    let closeRequested = false;
    let seq = 0;
    let lastFrameAt = Date.now();
    const encoder = new TextEncoder();
    /** Frames written but not yet handed to the HTTP layer. */
    const queue: Uint8Array[] = [];

    const doClose = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      try {
        controller.close();
      } catch {
        // Already closed or cancelled.
      }
      wakeDrain();
    };

    pumpQueue = (): void => {
      if (streamCancelled) {
        queue.length = 0;
        closed = true;
        wakeDrain();
        return;
      }
      while (queue.length > 0) {
        if (controller.desiredSize !== null && controller.desiredSize <= 0) return;
        try {
          controller.enqueue(queue.shift() as Uint8Array);
        } catch {
          streamCancelled = true;
          queue.length = 0;
          wakeDrain();
          return;
        }
      }
      wakeDrain();
      // Only close once every frame reached the HTTP layer: closing while our
      // queue still holds a frame would drop it (pull() stops running as soon
      // as close is requested).
      if (closeRequested && queue.length === 0) doClose();
    };

    const write = (frame: string): void => {
      if (streamCancelled || closed) return;
      queue.push(encoder.encode(frame));
      lastFrameAt = Date.now();
      pumpQueue();
    };

    const sendEvent = (event: TypedStreamEvent): void => {
      if (streamCancelled) return;
      if (event.type === "text_delta") partialContent += event.data.content;
      // `id:` is an SSE sequence marker — additive, consumers read `data:`.
      write(`id: ${++seq}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    const awaitDrain = async (): Promise<void> => {
      while (!streamCancelled && !closed && !lifecycle.signal.aborted && queue.length > 0) {
        await new Promise<void>((resolve) => {
          pendingDrain = resolve;
        });
      }
    };

    const onLifecycleAbort = () => wakeDrain();
    lifecycle.signal.addEventListener("abort", onLifecycleAbort, { once: true });

    // Keep-alive: proxies/CDN drop a silent connection while the model thinks
    // (setup + RAG + TTFB). SSE comment — invisible to `data:` consumers.
    const heartbeat = setInterval(() => {
      if (streamCancelled || closed || closeRequested) return;
      if (Date.now() - lastFrameAt >= heartbeatMs) {
        write(`: hb ${Date.now()}\n\n`);
      }
    }, heartbeatMs);

    const closeStream = () => {
      if (closed || closeRequested) return;
      closeRequested = true;
      clearInterval(heartbeat);
      wakeDrain();
      // Flush first; if the consumer still owes us demand, doClose() runs from
      // pull() as soon as the last queued frame has been delivered.
      pumpQueue();
      if (queue.length === 0) doClose();
    };

    const startTime = Date.now();

    try {
      if (lifecycle.signal.aborted) {
        throw lifecycle.signal.reason ?? chatAbortError("timeout");
      }

      sendEvent({
        type: "message_start",
        data: { messageId: `msg_${Date.now()}` },
        timestamp: Date.now(),
        conversationId: resolvedConversationId || "new",
        requestId,
      });

      const runPromise = orchestrator.run({
        conversationId: resolvedConversationId || "new",
        sessionId,
        userId,
        locale,
        requestId,
        userMessage: message,
        conversationHistory,
        stream: true,
        // Returning the drain promise is what propagates backpressure from the
        // HTTP consumer up to the provider read loop.
        onStream: async (event: TypedStreamEvent) => {
          sendEvent(event);
          await awaitDrain();
        },
        onToolStart: (event) => sendEvent(event),
        onToolResult: (event) => sendEvent(event),
        onCitation: (event) => sendEvent(event),
        authContext: {
          userId,
          isAuthenticated,
          isAdmin,
        },
      });
      // The race below can settle on the lifecycle abort while the run is
      // still in flight; once the run rejects late (e.g. after
      // nvidiaProvider.abort()), that rejection must be swallowed here or
      // Node sees an unhandledRejection. Does not affect the race result.
      void runPromise.catch(() => undefined);

      // A hung run must never outlive the HTTP request: the race settles on
      // the deadline/client-disconnect abort and the run is left to be
      // cancelled by nvidiaProvider.abort() in the catch below.
      const result: AgentRunResult = await Promise.race([
        runPromise,
        new Promise<never>((_resolve, reject) => {
          const rejectOnAbort = () => reject(lifecycle.signal.reason);
          if (lifecycle.signal.aborted) rejectOnAbort();
          else lifecycle.signal.addEventListener("abort", rejectOnAbort, { once: true });
        }),
      ]);

      try {
        await addMessage(convCtx, resolvedConversationId || "new", {
          role: "assistant",
          content: result.finalResponse,
        });
        assistantPersisted = true;
      } catch (persistError) {
        eventBus.emit("agent.error", requestId, {
          stage: "chat",
          message:
            persistError instanceof Error ? persistError.message : "Assistant persist failed",
        });
        throw persistError;
      }

      eventBus.emit("agent.response.completed", requestId, {
        durationMs: Date.now() - startTime,
      });

      sendEvent({
        type: "message_complete",
        data: {
          fullContent: result.finalResponse,
          usage: result.usage,
          toolCalls: result.toolCalls,
          conversationId: resolvedConversationId || "new",
        },
        timestamp: Date.now(),
        conversationId: resolvedConversationId || "new",
        requestId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      if (lifecycle.signal.aborted) {
        // Deadline hit or client gone: abort the in-flight LLM call so the
        // provider stops generating (and billing) for a dead request.
        nvidiaProvider.abort();
      }
      const errorCode: AgentErrorCode =
        error instanceof Error && "code" in error
          ? (error as { code: AgentErrorCode }).code
          : "INTERNAL_ERROR";
      const recoverable =
        error instanceof Error && "recoverable" in error
          ? (error as { recoverable: boolean }).recoverable
          : false;

      sendEvent({
        type: "error",
        data: {
          code: errorCode,
          message: error instanceof Error ? error.message : "Unknown error",
          recoverable,
        },
        timestamp: Date.now(),
        conversationId: resolvedConversationId || "new",
        requestId,
      });

      // LOT 23 — a stream cut by the deadline or by a client disconnect must
      // not lose what the user already read. Strictly gated on a lifecycle
      // abort: a GENERATION_FAILED (LOT 10) still never writes an assistant row.
      if (lifecycle.signal.aborted && !assistantPersisted && partialContent.trim().length > 0) {
        assistantPersisted = true;
        try {
          await addMessage(convCtx, resolvedConversationId || "new", {
            role: "assistant",
            content: partialContent,
          });
        } catch (persistError) {
          eventBus.emit("agent.error", requestId, {
            stage: "chat",
            message:
              persistError instanceof Error ? persistError.message : "Partial persist failed",
          });
        }
      }
    } finally {
      clearInterval(heartbeat);
      lifecycle.signal.removeEventListener("abort", onLifecycleAbort);
      lifecycle.cleanup();
      wakeDrain();
      closeStream();
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      void serveStream(controller).catch(() => {
        // Only reachable if the catch/finally above failed — never let the
        // rejection escape into the stream machinery unobserved.
        streamCancelled = true;
        wakeDrain();
        try {
          controller.error();
        } catch {
          // Already closed or cancelled.
        }
      });
    },
    pull() {
      pumpQueue();
    },
    cancel() {
      streamCancelled = true;
      pumpQueue();
      lifecycle.abort(chatAbortError("disconnect"));
      nvidiaProvider.abort();
    },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-request-id": requestId,
    },
  });

  return addSecurityHeaders(response);
}

export const chat = createServerFn({ method: "POST" })
  .middleware([chatSecurityMiddleware])
  .validator((data: unknown) => ChatMessageSchema.parse(data))
  .handler(async ({ context }) => {
    const ctx = context as {
      request: Request;
      user: SessionUser | null;
      sanitizedBody: Record<string, unknown>;
      requestId?: string;
    };
    return handleChatRequest({
      request: ctx.request,
      user: ctx.user ?? null,
      sanitizedBody: ctx.sanitizedBody,
      requestId: ctx.requestId ?? generateRequestId(),
    });
  });

export { ChatMessageSchema };
