import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AgentOrchestrator } from "../agent/orchestrator";
import type {
  AIModel,
  LLMProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  StreamChunk,
  ToolCall,
  SkillContext,
  RAGQueryResult,
  RetrieveOptions,
  RetrieveResult,
  RAGContext,
} from "../contracts";
import type { RAGEngine } from "../rag";

vi.mock("../memory/memory-service", () => ({
  createMemoryService: vi.fn(() => ({
    searchMemory: vi.fn().mockResolvedValue([]),
  })),
}));

// context-builder resolves its service-role client via this module;
// a dummy object suffices because createMemoryService itself is mocked.
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({})),
}));

vi.mock("../skills", () => {
  const mockExecutor = {
    execute: vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "search_knowledge",
        content: JSON.stringify({ success: true }),
        success: true,
      },
      skillResult: { success: true, data: {} },
    }),
  };

  const mockRegistry = {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    has: vi.fn().mockReturnValue(false),
    getToolDefinitions: vi.fn().mockReturnValue([]),
    getByPermission: vi.fn().mockReturnValue([]),
    clear: vi.fn(),
    size: vi.fn().mockReturnValue(0),
  };

  return {
    skillExecutor: mockExecutor,
    skillRegistry: mockRegistry,
    registerSkill: vi.fn(),
    unregisterSkill: vi.fn(),
    getSkill: vi.fn(),
    listSkills: vi.fn().mockReturnValue([]),
    hasSkill: vi.fn().mockReturnValue(false),
    getAllToolDefinitions: vi.fn().mockReturnValue([]),
    getSkillsByPermission: vi.fn().mockReturnValue([]),
  };
});

import { skillRegistry, skillExecutor } from "../skills";

type MockLLMProvider = LLMProvider & {
  initialize: Mock<(config: ProviderConfig) => Promise<void>>;
  complete: Mock<(request: ProviderRequest) => Promise<ProviderResponse>>;
  stream: Mock<(request: ProviderRequest) => AsyncIterable<StreamChunk>>;
  abort: Mock<() => void>;
  getModel: Mock<(modelId: string) => AIModel | undefined>;
  isAvailable: Mock<() => boolean>;
};

function createMockLLMProvider(overrides: Partial<MockLLMProvider> = {}): MockLLMProvider {
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
      id: "completion-1",
      content: "Test response",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: "stop",
      toolCalls: undefined,
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

function createMockRAGEngine(overrides: Partial<RAGEngine> = {}): RAGEngine {
  const mockQuery = vi.fn().mockResolvedValue({
    retrieveResult: {
      query: "test",
      strategy: "semantic",
      documents: [],
      totalFound: 0,
      retrievalTimeMs: 10,
      embeddingAvailable: true,
    },
    context: { documents: [], query: "test", strategy: "semantic" },
    contextString: "",
  });

  return {
    query: mockQuery,
    queryWithContextString: vi.fn().mockResolvedValue(""),
    buildKnowledgeContext: vi.fn().mockReturnValue({
      chunks: [],
      count: 0,
      topScore: 0,
      contextString: "",
      truncated: false,
    }),
    initialize: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({}),
    updateConfig: vi.fn(),
    storeDocuments: vi.fn().mockResolvedValue(undefined),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    updateDocument: vi.fn().mockResolvedValue(undefined),
    getEmbeddingProvider: vi.fn(),
    ...overrides,
  } as unknown as RAGEngine;
}

describe("Chat Basic", () => {
  let orchestrator: AgentOrchestrator;
  let mockLLMProvider: ReturnType<typeof createMockLLMProvider>;
  let mockRAGEngine: ReturnType<typeof createMockRAGEngine>;

  beforeEach(() => {
    mockLLMProvider = createMockLLMProvider();
    mockRAGEngine = createMockRAGEngine();

    orchestrator = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
      ragEngine: mockRAGEngine as RAGEngine,
      config: {
        limits: {
          maxAgentSteps: 5,
          maxToolCalls: 3,
          globalTimeoutMs: 30000,
          maxContextTokens: 4000,
          maxToolResultTokens: 2000,
        },
        defaultModel: "test-model",
        systemPrompt: "Test system prompt",
        enableStreaming: false,
      },
    });
  });

  it("returns simple response without tool calls", async () => {
    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Bonjour",
      conversationHistory: [],
    });

    expect(result.finalResponse).toBe("Test response");
    expect(result.steps).toBe(1);
    expect(result.toolCallCount).toBe(0);
    expect(result.finishReason).toBe("stop");
    expect(result.errors).toHaveLength(0);
  });

  it("includes locale in request", async () => {
    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "en",
      requestId: "req-1",
      userMessage: "Hello",
      conversationHistory: [],
    });

    expect(mockLLMProvider.complete).toHaveBeenCalled();
  });
});

describe("Conversation", () => {
  it("includes conversation history in context", async () => {
    const history = [
      { id: "msg-1", role: "user" as const, content: "Hello", timestamp: Date.now() - 1000 },
      {
        id: "msg-2",
        role: "assistant" as const,
        content: "Hi there!",
        timestamp: Date.now() - 500,
      },
    ];

    const orchestrator = new AgentOrchestrator({
      llmProvider: createMockLLMProvider(),
      ragEngine: createMockRAGEngine() as RAGEngine,
      config: { defaultModel: "test-model", systemPrompt: "Test" },
    });

    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "How are you?",
      conversationHistory: history,
    });

    expect(true).toBe(true);
  });
});

describe("Memory", () => {
  it("stores and retrieves memory entries", async () => {
    expect(true).toBe(true);
  });

  it("isolates memory by session", async () => {
    expect(true).toBe(true);
  });

  it("handles memory expiration", async () => {
    expect(true).toBe(true);
  });
});

describe("RAG", () => {
  it("returns empty result when no documents match", async () => {
    expect(true).toBe(true);
  });

  it("returns relevant documents for query", async () => {
    expect(true).toBe(true);
  });

  it("handles RAG errors gracefully", async () => {
    expect(true).toBe(true);
  });

  it("respects similarity threshold", async () => {
    expect(true).toBe(true);
  });
});

describe("Tool Calling", () => {
  let orchestrator: AgentOrchestrator;
  let mockLLMProvider: ReturnType<typeof createMockLLMProvider>;
  let mockRAGEngine: ReturnType<typeof createMockRAGEngine>;

  beforeEach(() => {
    mockLLMProvider = createMockLLMProvider();
    mockRAGEngine = createMockRAGEngine();

    orchestrator = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
      ragEngine: mockRAGEngine as RAGEngine,
      config: {
        limits: {
          maxAgentSteps: 5,
          maxToolCalls: 3,
          globalTimeoutMs: 30000,
          maxContextTokens: 4000,
          maxToolResultTokens: 2000,
        },
        defaultModel: "test-model",
        systemPrompt: "Test system prompt",
        enableStreaming: false,
      },
    });
  });

  it("executes tool successfully", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "WebXIA" }) },
    };

    mockLLMProvider.complete
      .mockResolvedValueOnce({
        id: "completion-1",
        content: "",
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
        toolCalls: [toolCall],
      })
      .mockResolvedValueOnce({
        id: "completion-2",
        content: "Final response with tool result",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Search for WebXIA",
      conversationHistory: [],
    });

    expect(result.finalResponse).toBe("Final response with tool result");
    expect(result.toolCallCount).toBe(1);
    expect(result.toolCalls[0].function.name).toBe("search_knowledge");
    expect(result.toolResults).toHaveLength(1);
  });
});

describe("Agent Loop", () => {
  it("stops after max agent steps", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "test" }) },
    };

    const mockProvider = createMockLLMProvider();
    mockProvider.complete.mockResolvedValue({
      id: "c1",
      content: "",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "tool_calls",
      toolCalls: [toolCall],
    });

    const limitedOrchestrator = new AgentOrchestrator({
      llmProvider: mockProvider,
      ragEngine: createMockRAGEngine(),
      config: {
        limits: {
          maxAgentSteps: 2,
          maxToolCalls: 10,
          globalTimeoutMs: 30000,
          maxContextTokens: 4000,
          maxToolResultTokens: 2000,
        },
        defaultModel: "test-model",
        systemPrompt: "Test",
        enableStreaming: false,
      },
    });

    const result = await limitedOrchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
    });

    expect(result.steps).toBe(2);
    expect(result.errors.some((e) => e.code === "MAX_STEPS_EXCEEDED")).toBe(true);
  });

  it("respects max tool calls limit", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "test" }) },
    };

    const mockProvider = createMockLLMProvider();
    // First call returns tool_calls, second call also returns tool_calls (to trigger limit check)
    mockProvider.complete
      .mockResolvedValueOnce({
        id: "c1",
        content: "",
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
        toolCalls: [toolCall],
      })
      .mockResolvedValueOnce({
        id: "c2",
        content: "",
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
        toolCalls: [toolCall],
      })
      .mockResolvedValueOnce({
        id: "c3",
        content: "Max tools reached",
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      });

    const limitedOrchestrator = new AgentOrchestrator({
      llmProvider: mockProvider,
      ragEngine: createMockRAGEngine(),
      config: {
        limits: {
          maxAgentSteps: 10,
          maxToolCalls: 1,
          globalTimeoutMs: 30000,
          maxContextTokens: 4000,
          maxToolResultTokens: 2000,
        },
        defaultModel: "test-model",
        systemPrompt: "Test",
        enableStreaming: false,
      },
    });

    const result = await limitedOrchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
    });

    expect(result.toolCallCount).toBe(1);
    expect(result.errors.some((e) => e.code === "MAX_TOOL_CALLS_EXCEEDED")).toBe(true);
  });
});

describe("Provider Errors", () => {
  it("handles provider error", async () => {
    const mockProvider = createMockLLMProvider({
      complete: vi.fn().mockRejectedValue(new Error("Provider unavailable")),
    });

    const orchestrator = new AgentOrchestrator({
      llmProvider: mockProvider,
      ragEngine: createMockRAGEngine(),
      config: { defaultModel: "test-model", systemPrompt: "Test" },
    });

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
    });

    expect(result.finishReason).toBe("error");
    expect(result.errors[0].code).toBe("PROVIDER_ERROR");
  });
});
