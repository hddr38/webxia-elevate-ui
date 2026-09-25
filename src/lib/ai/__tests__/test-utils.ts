import { vi, type Mock } from "vitest";
import type {
  LLMProvider,
  StreamChunk,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  AIModel,
  ToolCall,
  ToolDefinition,
} from "../providers/types";
import type { Message } from "../contracts";

export type MockLLMProvider = LLMProvider & {
  initialize: Mock<(config: ProviderConfig) => Promise<void>>;
  complete: Mock<(request: ProviderRequest) => Promise<ProviderResponse>>;
  stream: Mock<(request: ProviderRequest) => AsyncIterable<StreamChunk>>;
  abort: Mock<() => void>;
  getModel: Mock<(modelId: string) => AIModel | undefined>;
  isAvailable: Mock<() => boolean>;
};

export function createMockProvider(overrides: Partial<MockLLMProvider> = {}): MockLLMProvider {
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
    initialize: vi.fn<(config: ProviderConfig) => Promise<void>>().mockResolvedValue(undefined),
    complete: vi.fn<(request: ProviderRequest) => Promise<ProviderResponse>>().mockResolvedValue({
      id: "test-completion",
      content: "Test response",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: "stop",
    }),
    stream: vi
      .fn<(request: ProviderRequest) => AsyncIterable<StreamChunk>>()
      .mockImplementation(async function* (): AsyncIterable<StreamChunk> {
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
    abort: vi.fn<() => void>(),
    getModel: vi.fn<(modelId: string) => AIModel | undefined>().mockReturnValue(mockModel),
    isAvailable: vi.fn<() => boolean>().mockReturnValue(true),
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
  const roles: ("user" | "assistant")[] = ["user", "assistant", "user"];
  return Array.from(
    { length: count },
    (_, i): Message => ({
      id: `msg-${i}`,
      role: roles[i % roles.length],
      content: `Message ${i + 1}`,
      timestamp: Date.now() - (count - i) * 1000,
    }),
  );
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
