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

export interface ChatHandlerContext {
  request: Request;
  user: SessionUser | null;
  sanitizedBody: Record<string, unknown>;
  requestId: string;
}

export async function handleChatRequest(ctx: ChatHandlerContext): Promise<Response> {
  const { request, user, sanitizedBody, requestId } = ctx;

  const sessionId = sanitizedBody?.sessionId as string | undefined;
  const userId = user?.id;
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  // Strict anonymous Webi session check: present AND valid UUID.
  // sessionId is NOT an identity — ownership is verified explicitly below.
  if (!sessionId || !UUID_RE.test(sessionId)) {
    await import("@/lib/ai/security/audit-log").then(({ auditLogger }) =>
      auditLogger.logAuthFailure("unknown", "Missing or invalid session ID", {
        requestId,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
      }),
    );
    throw new Response("Unauthorized: No session", { status: 401 });
  }

  const conversationId = sanitizedBody?.conversationId as string | undefined;
  const message = sanitizedBody?.message as string;
  const locale = (sanitizedBody?.locale as string) ?? "fr";

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

    await addMessage(convCtx, resolvedConversationId, { role: "user", content: message });
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

  const nvidiaProvider = new NvidiaProvider();
  await nvidiaProvider.initialize(nvidiaConfig);

  const embeddingProvider = new NvidiaEmbeddingProvider();
  await embeddingProvider.initialize(nvidiaConfig);

  // Model id must exist on the NIM account (verified via /v1/models).
  // Primary is fast (Lightning 30B); fallback is the larger Super 120B,
  // used automatically on TIMEOUT / 5xx / 429 (never on 4xx logic errors).
  const chatModel = process.env.NVIDIA_NIM_DEFAULT_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const fallbackModel =
    process.env.NVIDIA_NIM_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b";

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
    llmProvider: modelRouter.getActive(),
    ragEngine,
    config: { defaultModel: chatModel },
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller: ReadableStreamDefaultController<Uint8Array>) {
      const sendEvent = (event: TypedStreamEvent) => {
        const eventData = JSON.stringify(event);
        controller.enqueue(new TextEncoder().encode(`data: ${eventData}\n\n`));
      };

      sendEvent({
        type: "message_start",
        data: { messageId: `msg_${Date.now()}` },
        timestamp: Date.now(),
        conversationId: resolvedConversationId || "new",
        requestId,
      });

      const startTime = Date.now();

      try {
        const result: AgentRunResult = await orchestrator.run({
          conversationId: resolvedConversationId || "new",
          sessionId,
          userId,
          locale,
          requestId,
          userMessage: message,
          conversationHistory,
          stream: true,
          onStream: (event: TypedStreamEvent) => {
            sendEvent(event);
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

        try {
          await addMessage(convCtx, resolvedConversationId || "new", {
            role: "assistant",
            content: result.finalResponse,
          });
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
      }

      controller.close();
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
