import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ConversationNotFoundError,
  getConversationHistory,
} from "@/lib/ai/conversation/conversation-service";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { getClientIdentifier, createRateLimiter } from "@/lib/ai/security/rate-limiter";
import { auditLogger } from "@/lib/ai/security/audit-log";
import { ChatHistorySchema } from "@/lib/ai/security/validation";
import type { Message } from "@/lib/ai/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same budget as the chat turn: `MAX_CONVERSATION_HISTORY` (validation.ts). */
export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 200;
const MAX_PAYLOAD_SIZE = 8192;

/** Dedicated bucket so restoring a transcript can never starve the chat turn. */
const historyRateLimiter = createRateLimiter("token-bucket", {
  windowMs: 60_000,
  maxRequests: 60,
  keyPrefix: "webi:chat-history",
  burstAllowance: 20,
});

export type ChatHistoryInput = z.infer<typeof ChatHistorySchema>;

/**
 * Read-only transcript DTO. Structurally assignable to the UI `ChatMessage`
 * (every extra field is optional) but carries no citations — they are not
 * persisted by `addMessage`, so a reloaded turn is text-only by design.
 */
export interface ChatHistoryMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
}

/**
 * Domain `Message` → wire DTO. `system` turns are server-internal scaffolding
 * and are never rendered, so they are dropped rather than leaked to the client.
 */
export function toChatHistoryMessage(message: Message): ChatHistoryMessage | null {
  if (message.role === "system") return null;
  const base = { id: message.id, content: message.content, timestamp: message.timestamp };
  if (message.role === "tool") {
    return { ...base, role: "tool", toolName: message.toolName, toolCallId: message.toolCallId };
  }
  return { ...base, role: message.role };
}

/** Defense-in-depth clamp for direct callers (the validator never reaches this). */
export function normalizeHistoryLimit(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_HISTORY_LIMIT;
  return Math.min(MAX_HISTORY_LIMIT, Math.max(1, Math.floor(raw)));
}

export interface ChatHistoryHandlerContext {
  request: Request;
  user: SessionUser | null;
  input: ChatHistoryInput;
  requestId: string;
}

/**
 * Resolve the transcript for one conversation, enforcing ADR-006 in depth:
 * the service runs on the service-role client (RLS never applies), so EVERY
 * query is filtered by `session_id` and a foreign conversation is
 * indistinguishable from a missing one (403, never an existence leak).
 *
 * HTTP contract mirrors `handleChatRequest`:
 * - missing / malformed sessionId → 401 + audit
 * - malformed conversationId     → 400
 * - foreign conversationId       → 403 + audit
 */
export async function handleChatHistoryRequest(
  ctx: ChatHistoryHandlerContext,
): Promise<ChatHistoryMessage[]> {
  const { request, user, input, requestId } = ctx;
  const userId = user?.id;

  // Strict anonymous Webi session check: present AND valid UUID.
  // sessionId is NOT an identity — ownership is verified by the service below.
  const sessionIdInput = input.sessionId as string | undefined;
  if (!sessionIdInput || typeof sessionIdInput !== "string" || !UUID_RE.test(sessionIdInput)) {
    await auditLogger.logAuthFailure("unknown", "Missing or invalid session ID", {
      requestId,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    throw new Response("Unauthorized: No session", { status: 401 });
  }
  // Narrowed once so no closure or later helper re-reads the unvalidated value.
  const sessionId: string = sessionIdInput;

  const conversationIdInput = input.conversationId as string | undefined;
  if (
    !conversationIdInput ||
    typeof conversationIdInput !== "string" ||
    !UUID_RE.test(conversationIdInput)
  ) {
    throw new Response("Bad Request: Invalid conversation id", { status: 400 });
  }
  const conversationId: string = conversationIdInput;

  const limit = normalizeHistoryLimit(input.limit);

  try {
    const history = await getConversationHistory({ sessionId, userId }, conversationId, limit);
    const messages: ChatHistoryMessage[] = [];
    for (const message of history) {
      const mapped = toChatHistoryMessage(message);
      if (mapped) messages.push(mapped);
    }
    return messages;
  } catch (error) {
    // Ownership failure: identical shape whether the row is missing or owned by
    // another session, so the response never confirms existence.
    if (error instanceof ConversationNotFoundError) {
      await auditLogger.logSecurityEvent("permission_denied", {
        severity: "high",
        userId,
        sessionId,
        conversationId,
        requestId,
        eventData: { reason: "Conversation session mismatch" },
        errorMessage: "Conversation session mismatch",
      });
      throw new Response("Forbidden: Session mismatch", { status: 403 });
    }
    throw error;
  }
}

/**
 * Rate limit + auth context only. Body parsing is intentionally absent: the
 * server-function payload is a transport envelope, so shape validation lives in
 * `.validator` and semantic validation lives in the handler.
 */
export const chatHistoryMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const requestId = crypto.randomUUID();
    const user = await getSessionUser(request);
    const clientId = getClientIdentifier(request, user?.id);
    const rateLimitResult = await historyRateLimiter.checkLimit(clientId);

    if (!rateLimitResult.allowed) {
      await auditLogger.logRateLimitExceeded(clientId, {
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        requestId,
      });
      const retryAfter = Math.max(1, Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAfter }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
      });
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      await auditLogger.logSecurityEvent("oversized_payload", {
        severity: "high",
        eventData: { contentLength, maxAllowed: MAX_PAYLOAD_SIZE },
        errorMessage: `Payload size ${contentLength} exceeds maximum ${MAX_PAYLOAD_SIZE}`,
        requestId,
      });
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }

    return next({ context: { request, user, requestId } });
  },
);

export const chatHistory = createServerFn({ method: "POST" })
  .middleware([chatHistoryMiddleware])
  .validator((data: unknown): ChatHistoryInput => {
    const parsed = ChatHistorySchema.safeParse(data);
    // Never let an unparseable body reach the handler as a 500.
    if (!parsed.success) throw new Response("Bad Request", { status: 400 });
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      request: Request;
      user: SessionUser | null;
      requestId: string;
    };
    return handleChatHistoryRequest({
      request: ctx.request,
      user: ctx.user ?? null,
      input: data,
      requestId: ctx.requestId ?? crypto.randomUUID(),
    });
  });

export { ChatHistorySchema };
