import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AgentOrchestrator } from "../agent/orchestrator";
import type {
  AIModel,
  Citation,
  LLMProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  StreamChunk,
  ToolCall,
  ToolDefinition,
  SkillContext,
} from "../contracts";
import type { RAGEngine } from "../rag";
import type { RAGQueryResult } from "../rag/rag-engine";

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

import { eventBus } from "../events";
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
    // Test double: only the exercised surface is mocked.
  } as unknown as RAGEngine;
}

describe("AgentOrchestrator", () => {
  let orchestrator: AgentOrchestrator;
  let mockLLMProvider: ReturnType<typeof createMockLLMProvider>;
  let mockRAGEngine: ReturnType<typeof createMockRAGEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLMProvider = createMockLLMProvider();
    mockRAGEngine = createMockRAGEngine();
    eventBus.clear();

    // Reset the mocked skill registry
    skillRegistry.clear();

    orchestrator = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
      ragEngine: mockRAGEngine,
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
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.finalResponse).toBe("Test response");
    expect(result.steps).toBe(1);
    expect(result.toolCallCount).toBe(0);
    expect(result.finishReason).toBe("stop");
    expect(result.errors).toHaveLength(0);
    expect(mockLLMProvider.complete).toHaveBeenCalled();
  });

  it("handles tool call and returns final response", async () => {
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
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.finalResponse).toBe("Final response with tool result");
    expect(result.steps).toBe(2);
    expect(result.toolCallCount).toBe(1);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe("search_knowledge");
    expect(result.toolResults).toHaveLength(1);
    expect(mockLLMProvider.complete).toHaveBeenCalledTimes(2);
  });

  it("handles multiple tool calls in sequence", async () => {
    const toolCall1: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "pricing" }) },
    };
    const toolCall2: ToolCall = {
      id: "call-2",
      type: "function",
      function: {
        name: "summarize",
        arguments: JSON.stringify({ text: "Long text about pricing" }),
      },
    };

    mockLLMProvider.complete
      .mockResolvedValueOnce({
        id: "c1",
        content: "",
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
        toolCalls: [toolCall1],
      })
      .mockResolvedValueOnce({
        id: "c2",
        content: "",
        model: "test-model",
        usage: { promptTokens: 15, completionTokens: 5, totalTokens: 20 },
        finishReason: "tool_calls",
        toolCalls: [toolCall2],
      })
      .mockResolvedValueOnce({
        id: "c3",
        content: "Final response after two tools",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Get pricing and summarize",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.steps).toBe(3);
    expect(result.toolCallCount).toBe(2);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].function.name).toBe("search_knowledge");
    expect(result.toolCalls[1].function.name).toBe("summarize");
  });

  it("handles skill execution error gracefully", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "fail" }) },
    };

    mockLLMProvider.complete
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
        content: "Error handled, here is alternative info",
        model: "test-model",
        usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
        finishReason: "stop",
      });

    // Mock skill executor to return error
    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "search_knowledge",
        content: JSON.stringify({ error: "Search failed" }),
        success: false,
        error: "Search service unavailable",
      },
      skillResult: {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: "Search service unavailable",
          recoverable: true,
        },
      },
    });

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Search for something",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.finalResponse).toBe("Error handled, here is alternative info");
    expect(result.toolResults[0].success).toBe(false);
    expect(result.errors.length).toBe(0);
  });

  it("handles provider error and returns error response", async () => {
    const { ProviderError } = await import("../providers/errors");
    mockLLMProvider.complete.mockRejectedValue(
      new ProviderError("Provider unavailable", "UNAVAILABLE", "test", true),
    );

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.finishReason).toBe("error");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("PROVIDER_UNAVAILABLE");
    expect(result.errors[0].recoverable).toBe(true);
  });

  it("handles provider authentication error as non-recoverable", async () => {
    const { ProviderError } = await import("../providers/errors");
    mockLLMProvider.complete.mockRejectedValue(
      new ProviderError("Invalid API key", "AUTHENTICATION_ERROR", "test", false),
    );

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.finishReason).toBe("error");
    expect(result.errors[0].code).toBe("PROVIDER_AUTH_ERROR");
    expect(result.errors[0].recoverable).toBe(false);
  });

  it("stops after max agent steps", async () => {
    // Configure orchestrator with very low max steps
    const limitedOrchestrator = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
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

    // Mock LLM to always request tool calls
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "test" }) },
    };

    mockLLMProvider.complete.mockResolvedValue({
      id: "c1",
      content: "",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "tool_calls",
      toolCalls: [toolCall],
    });

    const result = await limitedOrchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.steps).toBe(2);
    expect(result.errors.some((e) => e.code === "MAX_STEPS_EXCEEDED")).toBe(true);
  });

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

    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "How are you?",
      conversationHistory: history,
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    const callArgs = mockLLMProvider.complete.mock.calls[0][0];
    expect(callArgs.messages.length).toBeGreaterThan(2);
    expect(callArgs.messages[0].content).toBe("Hello");
    expect(callArgs.messages[1].content).toBe("Hi there!");
    expect(callArgs.messages[2].content).toBe("How are you?");
  });

  it("includes RAG context when available", async () => {
    const mockRAGResult = {
      retrieveResult: {
        query: "test",
        strategy: "semantic" as const,
        documents: [
          {
            id: "chunk-1",
            title: "Pricing Doc",
            content: "WebXIA pricing starts at 2500€",
            source: { type: "website" as const, url: "https://webxia.com/pricing" },
            metadata: {},
            score: 0.9,
            distance: 0.1,
            chunkId: "chunk-1",
            chunkIndex: 0,
            documentId: "doc-1",
          },
        ],
        totalFound: 1,
        retrievalTimeMs: 50,
        embeddingAvailable: true,
      },
      context: { documents: [], query: "pricing", strategy: "semantic" as const },
      contextString:
        "[DOCUMENT 1]\nTitle: Pricing Doc\nSource: website | https://webxia.com/pricing\nScore: 0.900\nContent: WebXIA pricing starts at 2500€",
    };

    const mockRAG = {
      query: vi.fn().mockResolvedValue(mockRAGResult),
      buildKnowledgeContext: vi.fn().mockReturnValue({
        chunks: mockRAGResult.retrieveResult.documents,
        count: 1,
        topScore: 0.9,
        contextString: mockRAGResult.contextString,
        truncated: false,
      }),
      getEmbeddingProvider: vi.fn(() => ({
        embed: vi.fn().mockResolvedValue([]),
      })),
      // Test double: only the exercised surface is mocked.
    } as unknown as RAGEngine;

    const orchestratorWithRAG = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
      ragEngine: mockRAG,
      config: { defaultModel: "test-model", systemPrompt: "Test" },
    });

    await orchestratorWithRAG.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "What is pricing?",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(mockRAG.query).toHaveBeenCalledWith("What is pricing?", expect.any(Object));
    const callArgs = mockLLMProvider.complete.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain("Pricing Doc");
    expect(callArgs.systemPrompt).toContain("2500€");
  });

  it("reports reasoningChunks in agent.llm.completed (stream path)", async () => {
    mockLLMProvider.stream.mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      yield { type: "chunk", content: "hi", index: 0 };
      yield {
        type: "done",
        content: "hi",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        finishReason: "stop",
        reasoningChunks: 7,
        index: 1,
      };
    });
    const seen: Array<{ model: string; durationMs: number; reasoningChunks?: number }> = [];
    eventBus.on("agent.llm.completed", (event) => {
      seen.push(event.payload);
    });

    const deltas: string[] = [];
    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-reason",
      userMessage: "Hello world, this message is long enough",
      conversationHistory: [],
      stream: true,
      onStream: (event) => {
        if (event.type === "text_delta") deltas.push(event.data.content);
      },
    });

    expect(deltas).toEqual(["hi"]);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.reasoningChunks).toBe(7);
  });

  it("respects max tool calls limit", async () => {
    const limitedOrchestrator = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
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

    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "test" }) },
    };

    mockLLMProvider.complete
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

    const result = await limitedOrchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.toolCallCount).toBe(1);
    expect(result.errors.some((e) => e.code === "MAX_TOOL_CALLS_EXCEEDED")).toBe(true);
  });

  it("emits correct events during execution", async () => {
    const eventSpy = vi.fn();
    const unsub = eventBus.on("agent.message.received", eventSpy);

    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent.message.received",
        requestId: "req-1",
        payload: { sessionId: "session-1", role: "user" },
      }),
    );

    unsub();
  });

  it("tracks usage metadata correctly", async () => {
    mockLLMProvider.complete
      .mockResolvedValueOnce({
        id: "c1",
        content: "",
        model: "test-model",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "tool_calls",
        toolCalls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "search_knowledge", arguments: "{}" },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "c2",
        content: "Final",
        model: "test-model",
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        finishReason: "stop",
      });

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
    });

    expect(result.usage.promptTokens).toBe(300);
    expect(result.usage.completionTokens).toBe(150);
    expect(result.usage.totalTokens).toBe(450);
  });

  it("handles unauthorized tool gracefully", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "admin_only_tool", arguments: "{}" },
    };

    mockLLMProvider.complete
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
        content: "I cannot use that tool",
        model: "test-model",
        usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
        finishReason: "stop",
      });

    // Mock skill executor to check permissions and return auth error for admin-only skill
    skillExecutor.execute = vi
      .fn()
      .mockImplementation(
        async (skillName: string, context: SkillContext, args: Record<string, unknown>) => {
          if (skillName === "admin_only_tool") {
            return {
              result: {
                toolCallId: "call-1",
                toolName: "admin_only_tool",
                content: JSON.stringify({ error: "Unauthorized: admin permission required" }),
                success: false,
                error: "Unauthorized: admin permission required",
              },
              skillResult: {
                success: false,
                error: {
                  code: "UNAUTHORIZED",
                  message: "Skill requires admin permission",
                  recoverable: false,
                },
              },
            };
          }
          // Default successful execution for other skills
          return {
            result: {
              toolCallId: "call-1",
              toolName: skillName,
              content: JSON.stringify({ success: true }),
              success: true,
            },
            skillResult: { success: true, data: {} },
          };
        },
      );

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.toolResults[0].success).toBe(false);
    expect(result.toolResults[0].error).toContain("admin");
  });
});

describe("AgentOrchestrator RAG citations", () => {
  let orchestrator: AgentOrchestrator;
  let mockLLMProvider: ReturnType<typeof createMockLLMProvider>;
  let mockRAGEngine: ReturnType<typeof createMockRAGEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLMProvider = createMockLLMProvider();
    mockRAGEngine = createMockRAGEngine();
    eventBus.clear();
    skillRegistry.clear();

    orchestrator = new AgentOrchestrator({
      llmProvider: mockLLMProvider,
      ragEngine: mockRAGEngine,
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

  it("emits citations with distinct documentId/chunkId from server retrieval", async () => {
    vi.mocked(mockRAGEngine.query).mockResolvedValue({
      retrieveResult: {
        query: "tarifs",
        strategy: "semantic",
        documents: [
          {
            id: "chunk-7",
            title: "Guide Tarifs",
            content: "Nos tarifs commencent à 5k euros pour un site vitrine.",
            source: { type: "manual", url: "https://example.com/tarifs" },
            metadata: {
              createdAt: 0,
              updatedAt: 0,
              tags: [],
              locale: "fr",
              priority: 0,
            },
            score: 0.91,
            distance: 0.09,
            chunkId: "chunk-7",
            chunkIndex: 2,
            documentId: "doc-7",
          },
        ],
        totalFound: 1,
        retrievalTimeMs: 12,
        embeddingAvailable: true,
      },
      context: { documents: [], query: "tarifs", strategy: "semantic" },
      contextString: "knowledge",
    });
    // Test double mirrors the real RAGEngine: knowledge chunks are the
    // retrieval documents (citations and prompt share one source).
    vi.mocked(mockRAGEngine.buildKnowledgeContext).mockImplementation((retrieveResult) => ({
      chunks: retrieveResult.documents,
      count: retrieveResult.documents.length,
      topScore: retrieveResult.documents[0]?.score ?? 0,
      contextString: "knowledge",
      truncated: false,
    }));

    const citations: Array<{ type: string; data: Citation }> = [];
    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-cit",
      userMessage: "Quels sont vos tarifs ?",
      conversationHistory: [],
      onCitation: (event) => {
        citations.push({ type: event.type, data: event.data });
      },
    });

    expect(citations).toHaveLength(1);
    const data = citations[0]?.data;
    // No phantom citation: every identity comes from server retrieval.
    expect(data?.documentId).toBe("doc-7");
    expect(data?.chunkId).toBe("chunk-7");
    expect(data?.chunkIndex).toBe(2);
    expect(data?.title).toBe("Guide Tarifs");
    expect(data?.source).toBe("https://example.com/tarifs");
    expect(data?.relevance).toBe(0.91);
    expect(data?.excerpt).toContain("Nos tarifs");
    expect(data?.documentId).not.toBe(data?.chunkId);
  });

  it("emits no citation when retrieval finds nothing", async () => {
    const onCitation = vi.fn();
    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-empty",
      userMessage: "Bonjour",
      conversationHistory: [],
      onCitation,
    });

    expect(onCitation).not.toHaveBeenCalled();
  });
});
