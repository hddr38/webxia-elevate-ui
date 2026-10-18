import { z } from "zod";
import { KNOWLEDGE_SOURCE_TYPES } from "../rag/types";

export const ChatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
  metadata: z.record(z.unknown()).optional(),
  /**
   * LOT 23 — client retry of a message already persisted by a failed attempt.
   * Server skips the duplicate user write only when a conversation id is also
   * present (i.e. the message provably lives there already).
   */
  isRetry: z.boolean().optional(),
});

/**
 * LOT 24 — chat history restore (read-only transcript fetch).
 *
 * The envelope is deliberately loose: `sessionId` / `conversationId` are
 * `unknown` so NO attacker-controlled payload can make Zod throw (a thrown
 * ZodError would surface as an opaque 500). Semantics — presence, UUID shape,
 * session ownership — are owned by `handleChatHistoryRequest`, which maps them
 * to deterministic 401 / 400 / 403 exactly like `handleChatRequest`.
 */
export const ChatHistorySchema = z.object({
  sessionId: z.unknown().optional(),
  conversationId: z.unknown().optional(),
  limit: z.unknown().optional(),
});

export const SearchKnowledgeInputSchema = z
  .object({
    query: z.string().min(1).max(500),
    topK: z.number().int().min(1).max(20).default(5),
    similarityThreshold: z.number().min(0).max(1).default(0.7),
    // Only filters the RPC actually applies (filter_locale /
    // filter_source_type). Strict: anything else is rejected, never dropped.
    locale: z.string().min(2).max(10).optional(),
    sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES).optional(),
  })
  .strict();

export const SummarizeInputSchema = z.object({
  text: z.string().min(1).max(50000),
  maxLength: z.number().int().min(50).max(2000).default(500),
  style: z.enum(["concise", "detailed", "bullet-points"]).default("concise"),
  focus: z.string().max(100).optional(),
});

export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return (
    input
      .slice(0, maxLength)
      // eslint-disable-next-line no-control-regex -- intentional stripping of control chars
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim()
  );
}

export function validateAndSanitize<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new ValidationError(`Validation failed: ${errors}`);
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export const MAX_CONVERSATION_HISTORY = 50;
