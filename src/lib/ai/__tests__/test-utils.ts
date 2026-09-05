import { vi } from "vitest";
import type {
  LLMProvider,
  StreamChunk,
  ProviderRequest,
  ProviderResponse,
  AIModel,
  ToolCall,
  ToolDefinition,
} from "../providers/types";
import type { Message } from "../contracts";

export function createMockProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  const mockModel: AIModel = {
    id: "test-model",
    name: "Test Model",
    provider: "test",
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      embeddings: false,
      vision: false,
    },
    maxTokens: 4096,
    costPerToken: { input: 0, output: 0 },
  };

  return {
    id: "test",
    name: "Test Provider",
    models: [mockModel],
    initialize: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue({
      id: "test-completion",
      content: "Test response",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: "stop",
    }),
    stream: vi.fn().mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      yield { type: "chunk", content: "Test ", index: 0 };
      yield { type: "chunk", content: "response", index: 1 };
      yield {
        type: "done",
        content: "Test response",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
        index: 2,
      };
    }),
    abort: vi.fn(),
    getModel: vi.fn().mockReturnValue(mockModel),
    isAvailable: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

export function createMockRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "test-model",
    messages: [{ id: "1", role: "user", content: "Hello", timestamp: Date.now() }],
    temperature: 0.7,
    maxTokens: 1000,
    stream: false,
    ...overrides,
  };
}

export function createMockStreamRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return createMockRequest({ ...overrides, stream: true });
}

export function createMockMessages(count: number = 3): Message[] {
  const roles: Message["role"][] = ["user", "assistant", "user"];
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: roles[i % roles.length],
    content: `Message ${i + 1}`,
    timestamp: Date.now() - (count - i) * 1000,
  }));
}

export function createMockToolCall(): ToolCall {
  return {
    id: "call-123",
    type: "function",
    function: {
      name: "search_knowledge",
      arguments: JSON.stringify({ query: "test query" }),
    },
  };
}

export function createMockToolDefinition(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search knowledge base",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  };
}
