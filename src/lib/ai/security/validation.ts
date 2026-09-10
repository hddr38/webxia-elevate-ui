import { z } from "zod";
import type { ToolDefinition } from "../contracts";

export const ChatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
  metadata: z.record(z.unknown()).optional(),
});

export const ChatResponseSchema = z.object({
  content: z.string(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  toolCalls: z.array(z.unknown()).optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  finishReason: z.enum(["stop", "length", "tool_calls", "error", "abort"]),
});

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1).max(100),
    arguments: z.string(),
  }),
});

export const ToolResultSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  content: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const SearchKnowledgeInputSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(5),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  filters: z.record(z.unknown()).optional(),
});

export const SummarizeInputSchema = z.object({
  text: z.string().min(1).max(50000),
  maxLength: z.number().int().min(50).max(2000).default(500),
  style: z.enum(["concise", "detailed", "bullet-points"]).default("concise"),
  focus: z.string().max(100).optional(),
});

export const MemorySearchOptionsSchema = z.object({
  sessionId: z.string().uuid().optional(),
  memoryType: z.enum(["conversation", "context", "knowledge", "preference"]).optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(10),
  page: z.number().int().positive().default(1),
});

export const CreateMemoryInputSchema = z.object({
  sessionId: z.string().uuid(),
  memoryType: z.enum(["conversation", "context", "knowledge", "preference"]),
  key: z.string().min(1).max(200),
  value: z.record(z.string()),
  metadata: z.record(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateMemoryInputSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(200).optional(),
  value: z.record(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const RAGQueryOptionsSchema = z.object({
  topK: z.number().int().min(1).max(20).default(5),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  strategy: z.enum(["semantic", "keyword", "hybrid", "rerank"]).default("semantic"),
  sessionId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  metadataFilters: z.record(z.unknown()).optional(),
});

export function createToolCallValidator(tools: ToolDefinition[]) {
  const toolNames = tools.map((t) => t.function.name);
  return z.object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({
      name: z.enum(toolNames as [string, ...string[]]),
      arguments: z.string(),
    }),
  });
}

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

export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_CONVERSATION_HISTORY = 50;
export const MAX_TOOL_ARGUMENTS_SIZE = 10000;
export const MAX_CONTEXT_SIZE = 128000;
