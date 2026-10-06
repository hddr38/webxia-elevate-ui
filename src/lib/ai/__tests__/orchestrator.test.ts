import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
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
import { skillRegistry, skillExecutor, getAllToolDefinitions } from "../skills";
import { auditLogger } from "../security/audit-log";

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

  it("executes tool calls even when finishReason is not tool_calls (FIX B)", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: JSON.stringify({ query: "WebXIA" }) },
    };

    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "search_knowledge",
        content: JSON.stringify({ success: true }),
        success: true,
      },
      skillResult: { success: true, data: {} },
    });

    mockLLMProvider.complete
      .mockResolvedValueOnce({
        id: "completion-1",
        content: "Assistant text alongside the tool call",
        model: "test-model",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
        toolCalls: [toolCall],
      })
      .mockResolvedValueOnce({
        id: "completion-2",
        content: "Final response after tool execution",
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

    // FIX B: the tool call must run despite finish_reason "stop".
    expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
    expect(result.toolCallCount).toBe(1);
    expect(result.toolResults).toHaveLength(1);
    expect(mockLLMProvider.complete).toHaveBeenCalledTimes(2);
    expect(result.finalResponse).toBe("Final response after tool execution");
    expect(result.steps).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("audits tool_execution_failure and recovers on malformed tool arguments (FIX C-bis)", async () => {
    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "search_knowledge", arguments: "{not-valid-json" },
    };

    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "search_knowledge",
        content: "{}",
        success: true,
      },
      skillResult: { success: true, data: {} },
    });

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
        content: "Recovered final answer",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
    const onToolResult = vi.fn();

    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Search for WebXIA",
      conversationHistory: [],
      onToolStart: vi.fn(),
      onToolResult,
      onCitation: vi.fn(),
    });

    // The malformed call never reaches the executor, is audited, and is
    // surfaced as a recoverable tool failure so the model can correct it.
    expect(skillExecutor.execute).not.toHaveBeenCalled();
    expect(auditSpy).toHaveBeenCalledWith(
      "tool_execution_failure",
      expect.objectContaining({
        severity: "medium",
        requestId: "req-1",
        eventData: expect.objectContaining({
          skill_name: "search_knowledge",
          received_args: expect.stringContaining("{not-valid-json"),
        }),
      }),
    );
    expect(onToolResult).toHaveBeenCalledTimes(1);
    expect(result.toolResults[0].success).toBe(false);
    expect(result.toolResults[0].error).toContain("Invalid JSON");
    expect(result.finalResponse).toBe("Recovered final answer");
    auditSpy.mockRestore();
  });

  it("excludes a tool from the next provider request after a successful execution (FIX F)", async () => {
    vi.mocked(getAllToolDefinitions).mockReturnValue([
      {
        type: "function",
        function: {
          name: "save_lead",
          description: "Save a lead",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);

    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: {
        name: "save_lead",
        arguments: JSON.stringify({
          first_name: "Jean",
          email: "jean@exemple.fr",
          summary: "x",
        }),
      },
    };

    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: { toolCallId: "call-1", toolName: "save_lead", content: "{}", success: true },
      skillResult: { success: true, data: {} },
    });

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
        content: "Confirmation finale",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    try {
      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.toolCallCount).toBe(1);

      const secondRequest = mockLLMProvider.complete.mock.calls[1][0];
      expect(secondRequest.tools ?? []).toHaveLength(0);
      // FIX F: every tool succeeded -> the key is omitted entirely (NIM
      // accepts the shape; mapTools(undefined) drops it from the payload).
      expect(secondRequest.tools).toBeUndefined();
      expect(result.finalResponse).toBe("Confirmation finale");
    } finally {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    }
  });

  it("keeps a tool available after a failed execution so it can be retried (FIX F)", async () => {
    vi.mocked(getAllToolDefinitions).mockReturnValue([
      {
        type: "function",
        function: {
          name: "save_lead",
          description: "Save a lead",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);

    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: {
        name: "save_lead",
        arguments: JSON.stringify({ first_name: "Jean", email: "jean@exemple.fr", summary: "x" }),
      },
    };

    skillExecutor.execute = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          toolCallId: "call-1",
          toolName: "save_lead",
          content: JSON.stringify({ error: "boom" }),
          success: false,
          error: "boom",
        },
        skillResult: {
          success: false,
          error: { code: "EXECUTION_FAILED", message: "boom", recoverable: true },
        },
      })
      .mockResolvedValueOnce({
        result: { toolCallId: "call-2", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: {} },
      });

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
        content: "Réponse après échec",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    try {
      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // First call fails, second succeeds (retry via server direct extraction)
      expect(skillExecutor.execute).toHaveBeenCalledTimes(2);
      expect(result.toolResults[0].success).toBe(false);
      expect(result.finalResponse).toContain("coordonnées ont bien été enregistrées");

      const secondRequest = mockLLMProvider.complete.mock.calls[1][0];
      expect(secondRequest.tools?.some((t) => t.function.name === "save_lead")).toBe(true);
    } finally {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    }
  });

  it("feeds the tool call and its result back to the next LLM request (FIX G)", async () => {
    vi.mocked(getAllToolDefinitions).mockReturnValue([
      {
        type: "function",
        function: {
          name: "save_lead",
          description: "Save a lead",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);

    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: {
        name: "save_lead",
        arguments: JSON.stringify({ first_name: "Jean", email: "jean@exemple.fr", summary: "x" }),
      },
    };

    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "save_lead",
        content: '{"ok":true}',
        success: true,
      },
      skillResult: { success: true, data: {} },
    });

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
        content: "Confirmation après résultat d'outil",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    try {
      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      const secondRequest = mockLLMProvider.complete.mock.calls[1][0];
      const roles = secondRequest.messages.map((m) => m.role);

      // Without FIX G the model received the SAME static conversation on
      // every step (no feedback) and blind-repeated save_lead to MAX_STEPS.
      expect(secondRequest.messages.some((m) => m.role === "assistant" && !!m.toolCalls)).toBe(
        true,
      );
      const toolMsg = secondRequest.messages.find((m) => m.role === "tool");
      expect(toolMsg).toBeDefined();
      expect(toolMsg?.content).toContain('"ok":true');
      expect(roles.indexOf("user")).toBeLessThan(roles.indexOf("tool"));
      expect(result.finalResponse).toBe("Confirmation après résultat d'outil");
    } finally {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    }
  });

  it("never re-executes a successful tool and ends the turn on the model text (FIX G1/G2)", async () => {
    vi.mocked(getAllToolDefinitions).mockReturnValue([
      {
        type: "function",
        function: {
          name: "save_lead",
          description: "Save a lead",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);

    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: {
        name: "save_lead",
        arguments: JSON.stringify({ first_name: "Jean", email: "jean@exemple.fr", summary: "x" }),
      },
    };

    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "save_lead",
        content: '{"ok":true}',
        success: true,
      },
      skillResult: { success: true, data: {} },
    });

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
        content: "Votre demande est bien enregistrée.",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "tool_calls",
        toolCalls: [{ ...toolCall, id: "call-2" }],
      });

    try {
      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // G1: the duplicate call never reaches the executor.
      expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.toolCallCount).toBe(1);

      // The duplicate still produced a canned "already completed" result.
      expect(result.toolResults).toHaveLength(2);
      expect(result.toolResults[1].success).toBe(true);
      expect(result.toolResults[1].content).toContain('"alreadyCompleted":true');

      // The real result of turn 1 was fed back to the model.
      const secondRequest = mockLLMProvider.complete.mock.calls[1][0];
      const fedBack = secondRequest.messages.filter((m) => m.role === "tool");
      expect(fedBack).toHaveLength(1);
      expect(fedBack[0].content).toContain('"ok":true');

      // G2: the turn ends on the model text instead of MAX_STEPS.
      expect(result.finalResponse).toBe("Votre demande est bien enregistrée.");
      expect(result.errors.some((e) => e.code === "MAX_STEPS_EXCEEDED")).toBe(false);
      expect(mockLLMProvider.complete).toHaveBeenCalledTimes(2);
    } finally {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    }
  });

  it("feeds the summarize result back to the next request (FIX G, non-lead tool)", async () => {
    vi.mocked(getAllToolDefinitions).mockReturnValue([
      {
        type: "function",
        function: {
          name: "summarize",
          description: "Summarize text",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);

    const toolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: { name: "summarize", arguments: JSON.stringify({ text: "Long text" }) },
    };

    skillExecutor.execute = vi.fn().mockResolvedValue({
      result: {
        toolCallId: "call-1",
        toolName: "summarize",
        content: '{"summary":"Résumé court."}',
        success: true,
      },
      skillResult: { success: true, data: {} },
    });

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
        content: "Voici le résumé demandé.",
        model: "test-model",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      });

    try {
      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Résume ce texte",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // FIX G is tool-agnostic: feedback works for summarize like save_lead.
      expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
      const secondRequest = mockLLMProvider.complete.mock.calls[1][0];
      expect(secondRequest.messages.some((m) => m.role === "assistant" && !!m.toolCalls)).toBe(
        true,
      );
      const toolMsg = secondRequest.messages.find((m) => m.role === "tool");
      expect(toolMsg?.content).toContain("Résumé court");
      // alreadyIncluded (context-builder): the user message is never duplicated.
      expect(secondRequest.messages.filter((m) => m.role === "user")).toHaveLength(1);
      expect(result.finalResponse).toBe("Voici le résumé demandé.");
      expect(result.steps).toBe(2);
    } finally {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    }
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

  it("rejects with GENERATION_FAILED on provider failure and never replays history", async () => {
    const { ProviderError } = await import("../providers/errors");
    mockLLMProvider.complete.mockRejectedValue(
      new ProviderError("Provider unavailable", "UNAVAILABLE", "test", true),
    );

    const error = await orchestrator
      .run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Test",
        conversationHistory: [
          { id: "m1", role: "user" as const, content: "Question?", timestamp: Date.now() - 1000 },
          {
            id: "m2",
            role: "assistant" as const,
            content: "OLD ANSWER FROM HISTORY",
            timestamp: Date.now() - 500,
          },
        ],
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      code: "GENERATION_FAILED",
      recoverable: true,
      details: { cause: "PROVIDER_UNAVAILABLE", steps: 1 },
    });
    // The rejection must never carry the previous answer as its content.
    expect((error as Error).message).not.toContain("OLD ANSWER FROM HISTORY");
    expect((error as Error).message).not.toContain("Question?");
  });

  it("rejects with GENERATION_FAILED on authentication error", async () => {
    const { ProviderError } = await import("../providers/errors");
    mockLLMProvider.complete.mockRejectedValue(
      new ProviderError("Invalid API key", "AUTHENTICATION_ERROR", "test", false),
    );

    await expect(
      orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Test",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      recoverable: true,
      details: { cause: "PROVIDER_AUTH_ERROR" },
    });
  });

  it("returns the provider answer, never a previous history message", async () => {
    const result = await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-1",
      userMessage: "Test",
      conversationHistory: [
        {
          id: "m2",
          role: "assistant" as const,
          content: "OLD ANSWER FROM HISTORY",
          timestamp: Date.now() - 500,
        },
      ],
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onCitation: vi.fn(),
    });

    expect(result.finalResponse).toBe("Test response");
    expect(result.finalResponse).not.toContain("OLD ANSWER FROM HISTORY");
    expect(result.finishReason).toBe("stop");
    expect(result.errors).toHaveLength(0);
  });

  it("rejects with GENERATION_FAILED when the final response is empty", async () => {
    mockLLMProvider.complete.mockResolvedValueOnce({
      id: "c-empty",
      content: "   ",
      model: "test-model",
      usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
      finishReason: "stop",
    });

    await expect(
      orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Test",
        conversationHistory: [
          {
            id: "m2",
            role: "assistant" as const,
            content: "OLD ANSWER FROM HISTORY",
            timestamp: Date.now() - 500,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      recoverable: true,
      details: { cause: "EMPTY_RESPONSE" },
    });
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

    await expect(
      limitedOrchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-1",
        userMessage: "Test",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      recoverable: true,
      details: { cause: "MAX_STEPS_EXCEEDED", steps: 2 },
    });
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

  it("reports ttftMs and chunkCount in agent.llm.completed (stream path)", async () => {
    mockLLMProvider.stream.mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      yield { type: "chunk", content: "a", index: 0 };
      yield { type: "chunk", content: "b", index: 1 };
      yield {
        type: "done",
        content: "ab",
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        finishReason: "stop",
        index: 2,
      };
    });
    const seen: Array<{ ttftMs?: number | null; chunkCount?: number }> = [];
    eventBus.on("agent.llm.completed", (event) => {
      seen.push(event.payload);
    });

    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-ttft",
      userMessage: "Hello world, this message is long enough",
      conversationHistory: [],
      stream: true,
      onStream: () => undefined,
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.chunkCount).toBe(2);
    // TTFT is measured, never negative, and reported as null when nothing streamed.
    expect(typeof seen[0]?.ttftMs).toBe("number");
    expect(seen[0]?.ttftMs).toBeGreaterThanOrEqual(0);
  });

  it("reports ttftMs null and chunkCount 0 when the stream yields no text", async () => {
    mockLLMProvider.stream.mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      yield {
        type: "done",
        content: "",
        usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
        finishReason: "stop",
        index: 0,
      };
    });
    const seen: Array<{ ttftMs?: number | null; chunkCount?: number }> = [];
    eventBus.on("agent.llm.completed", (event) => {
      seen.push(event.payload);
    });

    await expect(
      orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-no-ttft",
        userMessage: "Hello world, this message is long enough",
        conversationHistory: [],
        stream: true,
        onStream: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED" });

    // Telemetry is emitted before the empty-response guard: no text means no
    // measurable TTFT and zero chunks, not a fabricated 0ms.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.ttftMs).toBeNull();
    expect(seen[0]?.chunkCount).toBe(0);
  });

  it("awaits onStream before pulling the next chunk (backpressure)", async () => {
    const order: string[] = [];
    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

    mockLLMProvider.stream.mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      yield { type: "chunk", content: "one ", index: 0 };
      order.push("provider:two");
      yield { type: "chunk", content: "two", index: 1 };
      order.push("provider:done");
      yield {
        type: "done",
        content: "one two",
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        finishReason: "stop",
        index: 2,
      };
    });

    await orchestrator.run({
      conversationId: "conv-1",
      sessionId: "session-1",
      locale: "fr",
      requestId: "req-backpressure",
      userMessage: "Hello world, this message is long enough",
      conversationHistory: [],
      stream: true,
      onStream: async (event) => {
        if (event.type !== "text_delta") return;
        order.push(`enter:${event.data.content}`);
        await tick();
        order.push(`leave:${event.data.content}`);
      },
    });

    // The provider is not allowed to advance until the consumer finished with
    // the previous delta — that is what turns HTTP backpressure into provider
    // read-loop throttling instead of unbounded buffering.
    expect(order).toEqual([
      "enter:one ",
      "leave:one ",
      "provider:two",
      "enter:two",
      "leave:two",
      "provider:done",
    ]);
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

  // FIX K (LOT 38a quater) — forced save_lead tool_choice on contact.
  describe("forced save_lead tool_choice (FIX K)", () => {
    const saveLeadTool: ToolDefinition = {
      type: "function",
      function: {
        name: "save_lead",
        description: "Save a lead",
        parameters: { type: "object", properties: {} },
      },
    };

    const SAVE_LEAD_TOOL_CALL: ToolCall = {
      id: "call-sl",
      type: "function",
      function: {
        name: "save_lead",
        arguments: JSON.stringify({ first_name: "Jean", email: "jean@exemple.fr", summary: "x" }),
      },
    };

    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

    afterEach(() => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    });

    it("forces save_lead tool_choice when contact detected in user message", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([saveLeadTool]);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: {} },
      });

      mockLLMProvider.complete
        .mockResolvedValueOnce({
          id: "c1",
          content: "",
          model: "test-model",
          usage,
          finishReason: "tool_calls",
          toolCalls: [SAVE_LEAD_TOOL_CALL],
        })
        .mockResolvedValueOnce({
          id: "c2",
          content: "Lead enregistre, confirmation.",
          model: "test-model",
          usage,
          finishReason: "stop",
        });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-force",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      const firstRequest = (mockLLMProvider.complete.mock.calls[0]?.[0] ?? {}) as ProviderRequest;
      expect(firstRequest.toolChoice).toEqual({
        type: "function",
        function: { name: "save_lead" },
      });
      expect(result.finalResponse).toBe("Lead enregistre, confirmation.");
      expect(result.toolCallCount).toBe(1);
    });

    it("uses auto tool_choice when save_lead already succeeded (FIX F wins)", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([saveLeadTool]);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: {} },
      });

      mockLLMProvider.complete
        .mockResolvedValueOnce({
          id: "c1",
          content: "",
          model: "test-model",
          usage,
          finishReason: "tool_calls",
          toolCalls: [SAVE_LEAD_TOOL_CALL],
        })
        .mockResolvedValueOnce({
          id: "c2",
          content: "Confirmation finale.",
          model: "test-model",
          usage,
          finishReason: "stop",
        });

      await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-auto-after",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      expect(mockLLMProvider.complete).toHaveBeenCalledTimes(2);
      const secondRequest = (mockLLMProvider.complete.mock.calls[1]?.[0] ?? {}) as ProviderRequest;
      expect(secondRequest.toolChoice).toBe("auto");
      // FIX F: save_lead is no longer offered -> forcing it would 400 NIM.
      expect(secondRequest.tools ?? []).toHaveLength(0);
    });

    it("uses auto tool_choice when no contact in user message", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([saveLeadTool]);

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-no-contact",
        userMessage: "Bonjour, je veux un site",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      const firstRequest = (mockLLMProvider.complete.mock.calls[0]?.[0] ?? {}) as ProviderRequest;
      expect(firstRequest.toolChoice).toBe("auto");
      expect(result.finalResponse).toBe("Test response");
    });

    it("audits tool_execution_failure when forced tool_choice is violated", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([saveLeadTool]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      // Contact + save_lead available => forced turn, but the model
      // answers with plain text (no tool call): the anomaly must be traced.
      // Server direct extraction should kick in and save the lead.
      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-violated",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // Forced tool_choice violation still audited
      expect(auditSpy).toHaveBeenCalledWith(
        "tool_execution_failure",
        expect.objectContaining({
          severity: "high",
          errorMessage: "forced_tool_choice_violated",
          eventData: expect.objectContaining({
            skill_name: "save_lead",
            guard_triggered: "forced_tool_choice",
          }),
        }),
      );
      expect(logSpy.mock.calls.some((c) => c[0] === "[Webi] forced_tool_choice_violated")).toBe(
        true,
      );

      // Server direct extraction kicks in and generates confirmation
      expect(result.finalResponse).toContain("coordonnées ont bien été enregistrées");
      expect(result.finalResponse).toContain("recontacterons");

      // Lead created audit also emitted (source: server_direct_extract)
      expect(auditSpy).toHaveBeenCalledWith(
        "lead_created",
        expect.objectContaining({
          severity: "low",
          eventData: expect.objectContaining({
            source: "server_direct_extract",
            firstName: "Jean",
            hasEmail: true,
          }),
        }),
      );

      expect(result.errors).toHaveLength(0);

      auditSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe("server fallback confirmation (LOT 38a quinquies)", () => {
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

    const SAVE_LEAD_TOOL: ToolDefinition = {
      type: "function",
      function: {
        name: "save_lead",
        description: "Save a visitor lead",
        parameters: { type: "object", properties: {} },
      },
    };

    const SAVE_LEAD_TOOL_CALL: ToolCall = {
      id: "call-sl",
      type: "function",
      function: {
        name: "save_lead",
        arguments: JSON.stringify({ first_name: "Jean", email: "jean@exemple.fr", summary: "x" }),
      },
    };

    afterEach(() => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    });

    it("returns server fallback confirmation when content empty after successful tool", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: {} },
      });

      // Turn 1: forced tool call, content empty after strip
      // Turn 2: model returns empty (simulates fallback model emitting only markup stripped to empty)
      mockLLMProvider.complete
        .mockResolvedValueOnce({
          id: "c1",
          content: "", // will be stripped to empty by our fix
          model: "test-model",
          usage,
          finishReason: "tool_calls",
          toolCalls: [SAVE_LEAD_TOOL_CALL],
        })
        .mockResolvedValueOnce({
          id: "c2",
          content: "",
          model: "test-model",
          usage,
          finishReason: "stop",
          toolCalls: [],
        });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-fallback",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // Server fallback confirmation generated
      expect(result.finalResponse).toContain("coordonnées ont bien été enregistrées");
      expect(result.finalResponse).toContain("recontacterons");

      // Audit emitted for fallback
      expect(auditSpy).toHaveBeenCalledWith(
        "tool_execution_failure",
        expect.objectContaining({
          severity: "low",
          errorMessage: "server_fallback_confirmation",
          eventData: expect.objectContaining({
            server_fallback: "confirmation_message",
          }),
        }),
      );
      expect(logSpy.mock.calls.some((c) => c[0] === "[Webi] server_fallback_confirmation")).toBe(
        true,
      );

      auditSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("does not use fallback when content is non-empty", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: {} },
      });

      mockLLMProvider.complete
        .mockResolvedValueOnce({
          id: "c1",
          content: "",
          model: "test-model",
          usage,
          finishReason: "tool_calls",
          toolCalls: [SAVE_LEAD_TOOL_CALL],
        })
        .mockResolvedValueOnce({
          id: "c2",
          content: "Confirmation personnalisée du modèle.",
          model: "test-model",
          usage,
          finishReason: "stop",
          toolCalls: [],
        });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-no-fallback",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // Model's own confirmation preserved
      expect(result.finalResponse).toBe("Confirmation personnalisée du modèle.");
      // No fallback audit
      expect(auditSpy).not.toHaveBeenCalledWith(
        "tool_execution_failure",
        expect.objectContaining({ errorMessage: "server_fallback_confirmation" }),
      );

      auditSpy.mockRestore();
    });

    it("does not use fallback when no tool succeeded", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
      // Model returns empty without any tool call
      mockLLMProvider.complete.mockResolvedValueOnce({
        id: "c1",
        content: "",
        model: "test-model",
        usage,
        finishReason: "stop",
        toolCalls: [],
      });

      await expect(
        orchestrator.run({
          conversationId: "conv-1",
          sessionId: "session-1",
          locale: "fr",
          requestId: "req-empty-no-tool",
          userMessage: "Bonjour",
          conversationHistory: [],
          onToolStart: vi.fn(),
          onToolResult: vi.fn(),
          onCitation: vi.fn(),
        }),
      ).rejects.toThrow("LLM generation failed");
    });
  });

  describe("server direct extraction (LOT 38a quinquies FIX L)", () => {
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

    const SAVE_LEAD_TOOL: ToolDefinition = {
      type: "function",
      function: {
        name: "save_lead",
        description: "Save a visitor lead",
        parameters: { type: "object", properties: {} },
      },
    };

    afterEach(() => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    });

    it("uses server direct extraction when LLM ignores save_lead", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: { leadId: "lead-direct-123" } },
      });

      // LLM returns no tool call, just text (ignores forced tool_choice)
      mockLLMProvider.complete.mockResolvedValueOnce({
        id: "c1",
        content: "Merci pour votre message.",
        model: "test-model",
        usage,
        finishReason: "stop",
        toolCalls: [],
      });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-direct-extract",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // Server direct extraction triggered
      expect(logSpy.mock.calls.some((c) => c[0] === "[Webi] server_direct_extract")).toBe(true);
      expect(skillExecutor.execute).toHaveBeenCalledWith(
        "save_lead",
        expect.objectContaining({ conversationId: "conv-1", sessionId: "session-1" }),
        expect.objectContaining({
          first_name: "Jean",
          email: "jean@exemple.fr",
        }),
      );

      // Confirmation generated
      expect(result.finalResponse).toContain("coordonnées ont bien été enregistrées");
      expect(result.finalResponse).toContain("recontacterons");

      // Audit emitted for lead_created (not fallback)
      expect(auditSpy).toHaveBeenCalledWith(
        "lead_created",
        expect.objectContaining({
          severity: "low",
          eventData: expect.objectContaining({
            source: "server_direct_extract",
            firstName: "Jean",
            hasEmail: true,
          }),
        }),
      );

      auditSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("does not extract when LLM already called save_lead", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: {} },
      });

      // LLM calls save_lead normally
      mockLLMProvider.complete
        .mockResolvedValueOnce({
          id: "c1",
          content: "",
          model: "test-model",
          usage,
          finishReason: "tool_calls",
          toolCalls: [
            { id: "call-1", type: "function", function: { name: "save_lead", arguments: "{}" } },
          ],
        })
        .mockResolvedValueOnce({
          id: "c2",
          content: "Confirmation du modèle.",
          model: "test-model",
          usage,
          finishReason: "stop",
          toolCalls: [],
        });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-no-extract",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // Normal flow, no direct extraction
      expect(result.finalResponse).toBe("Confirmation du modèle.");
      // skillExecutor called once for the LLM tool call, not for direct extraction
      expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
    });

    it("does not extract when no contact detected", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);

      mockLLMProvider.complete.mockResolvedValueOnce({
        id: "c1",
        content: "Pas de contact ici.",
        model: "test-model",
        usage,
        finishReason: "stop",
        toolCalls: [],
      });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-no-contact",
        userMessage: "Bonjour, je veux un site",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // No contact info in user message, LLM response returned normally
      expect(result.finalResponse).toBe("Pas de contact ici.");
      // No server direct extraction (no contact info)
      expect(auditSpy).not.toHaveBeenCalledWith(
        "lead_created",
        expect.objectContaining({ source: "server_direct_extract" }),
      );

      auditSpy.mockRestore();
    });

    it("does not extract when user message has no extractable contact", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);

      mockLLMProvider.complete.mockResolvedValueOnce({
        id: "c1",
        content: "Je ne comprends pas.",
        model: "test-model",
        usage,
        finishReason: "stop",
        toolCalls: [],
      });

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-no-extractable",
        userMessage: "Contactez-moi plus tard", // no email/phone/name
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // No extractable contact info, LLM response returned normally
      expect(result.finalResponse).toBe("Je ne comprends pas.");
      expect(auditSpy).not.toHaveBeenCalledWith(
        "lead_created",
        expect.objectContaining({ source: "server_direct_extract" }),
      );

      auditSpy.mockRestore();
    });
  });

  describe("LLM failure fallback (LOT 38a quinquies)", () => {
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

    const SAVE_LEAD_TOOL: ToolDefinition = {
      type: "function",
      function: {
        name: "save_lead",
        description: "Save a visitor lead",
        parameters: { type: "object", properties: {} },
      },
    };

    afterEach(() => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([]);
    });

    it("extracts server-side and confirms when the LLM call times out on a contact message", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-fb", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: { leadId: "lead-fb-123" } },
      });

      const { ProviderError } = await import("../providers/errors");
      mockLLMProvider.complete.mockRejectedValueOnce(
        new ProviderError("Timeout", "TIMEOUT", "test", true),
      );

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-llm-timeout-contact",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // Direct extraction ran and the visitor got the standard confirmation
      expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
      expect(skillExecutor.execute).toHaveBeenCalledWith(
        "save_lead",
        expect.objectContaining({ conversationId: "conv-1", sessionId: "session-1" }),
        expect.objectContaining({ first_name: "Jean", email: "jean@exemple.fr" }),
      );
      expect(result.finalResponse).toContain("coordonnées ont bien été enregistrées");
      expect(result.finalResponse).toContain("recontacterons");
      expect(result.errors).toHaveLength(0);
      expect(
        logSpy.mock.calls.some((c) => c[0] === "[Webi] server_direct_extract_on_llm_failure"),
      ).toBe(true);

      expect(auditSpy).toHaveBeenCalledWith(
        "lead_created",
        expect.objectContaining({
          severity: "low",
          eventData: expect.objectContaining({
            source: "server_direct_extract_on_llm_failure",
            firstName: "Jean",
            hasEmail: true,
          }),
        }),
      );

      auditSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("returns the confirmation when the LLM fails after save_lead already succeeded", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      skillExecutor.execute = vi.fn().mockResolvedValue({
        result: { toolCallId: "call-sl", toolName: "save_lead", content: "{}", success: true },
        skillResult: { success: true, data: { leadId: "lead-after-456" } },
      });

      // Turn 1: save_lead succeeds, turn 2 (final confirmation) times out
      mockLLMProvider.complete
        .mockResolvedValueOnce({
          id: "c1",
          content: "",
          model: "test-model",
          usage,
          finishReason: "tool_calls",
          toolCalls: [
            { id: "call-1", type: "function", function: { name: "save_lead", arguments: "{}" } },
          ],
        })
        .mockRejectedValueOnce(
          new (await import("../providers/errors")).ProviderError(
            "Request timeout",
            "TIMEOUT",
            "test",
            true,
          ),
        );

      const result = await orchestrator.run({
        conversationId: "conv-1",
        sessionId: "session-1",
        locale: "fr",
        requestId: "req-timeout-after-save",
        userMessage: "Je m'appelle Jean, mon email est jean@exemple.fr",
        conversationHistory: [],
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onCitation: vi.fn(),
      });

      // The lead is safe: the visitor gets the confirmation, not an error
      expect(result.finalResponse).toContain("coordonnées ont bien été enregistrées");
      expect(result.finalResponse).toContain("recontacterons");
      expect(result.errors).toHaveLength(0);

      // No second extraction (save_lead already ran)
      expect(skillExecutor.execute).toHaveBeenCalledTimes(1);
      expect(
        logSpy.mock.calls.some((c) => c[0] === "[Webi] provider_failure_after_save_lead"),
      ).toBe(true);

      expect(auditSpy).toHaveBeenCalledWith(
        "tool_execution_failure",
        expect.objectContaining({
          severity: "low",
          eventData: expect.objectContaining({
            source: "provider_failure_after_save_lead",
            skill_name: "save_lead",
          }),
        }),
      );

      auditSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("propagates the LLM failure when no contact is detected", async () => {
      vi.mocked(getAllToolDefinitions).mockReturnValue([SAVE_LEAD_TOOL]);
      const auditSpy = vi.spyOn(auditLogger, "logSecurityEvent").mockResolvedValue(undefined);
      skillExecutor.execute = vi.fn();

      const { ProviderError } = await import("../providers/errors");
      mockLLMProvider.complete.mockRejectedValueOnce(
        new ProviderError("Timeout", "TIMEOUT", "test", true),
      );

      await expect(
        orchestrator.run({
          conversationId: "conv-1",
          sessionId: "session-1",
          locale: "fr",
          requestId: "req-llm-timeout-no-contact",
          userMessage: "Bonjour, je veux un site",
          conversationHistory: [],
          onToolStart: vi.fn(),
          onToolResult: vi.fn(),
          onCitation: vi.fn(),
        }),
      ).rejects.toThrow("LLM generation failed");

      // No server-side lead recovery without contact details
      expect(skillExecutor.execute).not.toHaveBeenCalled();
      expect(auditSpy).not.toHaveBeenCalledWith(
        "lead_created",
        expect.objectContaining({
          eventData: expect.objectContaining({
            source: "server_direct_extract_on_llm_failure",
          }),
        }),
      );

      auditSpy.mockRestore();
    });
  });
});
