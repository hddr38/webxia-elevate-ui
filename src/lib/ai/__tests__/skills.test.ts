import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  InMemorySkillRegistry,
  skillRegistry,
  registerSkill,
  unregisterSkill,
  getSkill,
  listSkills,
  hasSkill,
  getAllToolDefinitions,
  getSkillsByPermission,
} from "../skills/registry";
import { SkillExecutor } from "../skills/executor";
import { SkillValidator, createSkillSchema, SkillValidationError } from "../skills/validator";
import { SearchKnowledgeSkill, createSearchKnowledgeSkill } from "../skills/search-knowledge";
import { SummarizeSkill, createSummarizeSkill } from "../skills/summarize";
import {
  Skill,
  SkillContext,
  SkillInput,
  SkillOutput,
  ToolPermission,
  ToolDefinition,
} from "../skills/types";
import type { RAGEngine } from "../rag";
import type { LLMProvider } from "../providers";

function createMockSkillContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    conversationId: "conv-1",
    sessionId: "session-1",
    userId: "user-1",
    locale: "fr",
    requestId: "req-1",
    ...overrides,
  };
}

function createMockRAGEngine(): Partial<RAGEngine> {
  return {
    query: vi.fn().mockResolvedValue({
      retrieveResult: {
        query: "test",
        strategy: "semantic",
        documents: [
          {
            id: "chunk-1",
            title: "Test Doc",
            content: "Test content about WebXIA",
            source: { type: "website", url: "https://example.com" },
            metadata: { author: "Test" },
            score: 0.9,
            distance: 0.1,
            chunkId: "chunk-1",
            chunkIndex: 0,
            documentId: "doc-1",
          },
        ],
        totalFound: 1,
        retrievalTimeMs: 100,
        embeddingAvailable: true,
      },
      context: {
        documents: [],
        query: "test",
        strategy: "semantic",
      },
      contextString: "Test context",
    }),
  };
}

function createMockLLMProvider(): Partial<LLMProvider> {
  return {
    complete: vi.fn().mockResolvedValue({
      id: "completion-1",
      content: "This is a test summary.",
      model: "test-model",
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      finishReason: "stop",
    }),
    getModel: vi.fn().mockReturnValue({
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
    }),
    isAvailable: vi.fn().mockReturnValue(true),
  };
}

describe("SkillRegistry", () => {
  let registry: InMemorySkillRegistry;

  beforeEach(() => {
    registry = new InMemorySkillRegistry();
  });

  const createTestSkill = (name: string, permissions: ToolPermission[] = ["public"]): Skill => ({
    name,
    description: `Test skill ${name}`,
    schema: { type: "object", properties: {} },
    permissions,
    toToolDefinition: () => ({
      type: "function",
      function: { name, description: "", parameters: {} },
    }),
    validate: (input: unknown): SkillInput => input as SkillInput,
    execute: vi.fn().mockResolvedValue({ success: true, data: {} }),
  });

  it("registers and retrieves skills", () => {
    const skill = createTestSkill("test_skill");
    registry.register(skill);

    expect(registry.has("test_skill")).toBe(true);
    expect(registry.get("test_skill")).toBe(skill);
  });

  it("throws on duplicate registration", () => {
    const skill = createTestSkill("duplicate");
    registry.register(skill);
    expect(() => registry.register(skill)).toThrow("already registered");
  });

  it("unregisters skills", () => {
    const skill = createTestSkill("to_remove");
    registry.register(skill);
    registry.unregister("to_remove");
    expect(registry.has("to_remove")).toBe(false);
  });

  it("lists all skills", () => {
    registry.register(createTestSkill("skill_1"));
    registry.register(createTestSkill("skill_2"));
    expect(registry.getAll()).toHaveLength(2);
  });

  it("gets tool definitions", () => {
    registry.register(createTestSkill("skill_1"));
    registry.register(createTestSkill("skill_2"));
    const defs = registry.getToolDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs[0].function.name).toBe("skill_1");
  });

  it("filters by permission", () => {
    registry.register(createTestSkill("public_skill", ["public"]));
    registry.register(createTestSkill("admin_skill", ["admin"]));
    registry.register(createTestSkill("auth_skill", ["authenticated"]));

    expect(registry.getByPermission("public")).toHaveLength(1);
    expect(registry.getByPermission("admin")).toHaveLength(1);
    expect(registry.getByPermission("authenticated")).toHaveLength(1);
  });
});

describe("Global Skill Registry Functions", () => {
  beforeEach(() => {
    skillRegistry.clear();
  });

  it("registerSkill adds to global registry", () => {
    const skill = {
      name: "global_test",
      description: "",
      schema: {},
      permissions: ["public"] as ToolPermission[],
      toToolDefinition: () => ({}) as ToolDefinition,
      validate: vi.fn(),
      execute: vi.fn(),
    };
    registerSkill(skill as Skill<Record<string, unknown>, Record<string, unknown>>);
    expect(hasSkill("global_test")).toBe(true);
    unregisterSkill("global_test");
  });

  it("getAllToolDefinitions returns all definitions", () => {
    skillRegistry.clear();
    skillRegistry.register({
      name: "skill_a",
      description: "",
      schema: {},
      permissions: ["public"],
      toToolDefinition: () => ({
        type: "function",
        function: { name: "skill_a", description: "", parameters: {} },
      }),
      validate: vi.fn(),
      execute: vi.fn(),
    });
    const defs = getAllToolDefinitions();
    expect(defs.some((d) => d.function.name === "skill_a")).toBe(true);
  });
});

describe("SkillValidator", () => {
  it("validates input with Zod schema", () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().optional() });
    const validator = createSkillSchema(schema);

    expect(validator({ name: "John" })).toEqual({ name: "John" });
    expect(validator({ name: "John", age: 30 })).toEqual({ name: "John", age: 30 });
  });

  it("throws SkillValidationError on invalid input", () => {
    const schema = z.object({ name: z.string().min(1) });
    const validator = createSkillSchema(schema);

    expect(() => validator({})).toThrow(SkillValidationError);
    expect(() => validator({ name: "" })).toThrow(SkillValidationError);
  });

  it("SkillValidator.validate uses skill's validate method", () => {
    const skill: Skill = {
      name: "test",
      description: "",
      schema: {},
      permissions: ["public"],
      toToolDefinition: () => ({}) as ToolDefinition,
      validate: createSkillSchema(z.object({ required: z.string() })),
      execute: vi.fn(),
    };

    expect(() => SkillValidator.validate(skill, {})).toThrow(SkillValidationError);
    expect(() => SkillValidator.validate(skill, { required: "value" })).not.toThrow();
  });
});

describe("SkillExecutor", () => {
  let executor: SkillExecutor;
  let mockSkill: Skill;

  beforeEach(() => {
    // NOTE: SkillExecutor reads auth from context.metadata (see executor.checkPermissions);
    // constructor takes no options — auth state is expressed per-context below.
    executor = new SkillExecutor();

    mockSkill = {
      name: "test_skill",
      description: "Test skill",
      schema: { type: "object", properties: { input: { type: "string" } } },
      permissions: ["public"],
      toToolDefinition: () => ({
        type: "function",
        function: { name: "test_skill", description: "", parameters: {} },
      }),
      validate: vi.fn((input: unknown) => {
        if (!input || typeof input !== "object" || !("input" in input)) {
          throw new Error("Invalid input");
        }
        return input;
      }),
      execute: vi.fn().mockResolvedValue({
        success: true,
        data: { result: "success" },
      }),
    };

    skillRegistry.clear();
    skillRegistry.register(mockSkill);
  });

  it("executes skill successfully", async () => {
    const context = createMockSkillContext();
    const result = await executor.execute("test_skill", context, { input: "test" });

    expect(result.result.success).toBe(true);
    expect(result.skillResult.success).toBe(true);
    expect(mockSkill.execute).toHaveBeenCalled();
  });

  it("returns error for unknown skill", async () => {
    const context = createMockSkillContext();
    const result = await executor.execute("unknown_skill", context, {});

    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain("not found");
  });

  it("returns error for validation failure", async () => {
    const context = createMockSkillContext();
    mockSkill.validate = vi.fn().mockImplementation(() => {
      throw new Error("Validation failed");
    });

    const result = await executor.execute("test_skill", context, { invalid: true });

    expect(result.result.success).toBe(false);
    expect(result.skillResult.error?.code).toBe("VALIDATION_ERROR");
  });

  it("checks admin permission", async () => {
    const adminSkill: Skill = {
      ...mockSkill,
      name: "admin_skill",
      permissions: ["admin"],
    };
    skillRegistry.register(adminSkill);

    const executorNoAdmin = new SkillExecutor();

    const context = createMockSkillContext();
    const result = await executorNoAdmin.execute("admin_skill", context, { input: "test" });

    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain("admin");
  });

  it("checks authenticated permission", async () => {
    const authSkill: Skill = {
      ...mockSkill,
      name: "auth_skill",
      permissions: ["authenticated"],
    };
    skillRegistry.register(authSkill);

    const executorNoAuth = new SkillExecutor();

    const context = createMockSkillContext();
    const result = await executorNoAuth.execute("auth_skill", context, { input: "test" });

    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain("authentication");
  });

  it("allows public skills without auth", async () => {
    const executorNoAuth = new SkillExecutor();

    const context = createMockSkillContext();
    const result = await executorNoAuth.execute("test_skill", context, { input: "test" });

    expect(result.result.success).toBe(true);
  });

  it("returns tool result with proper structure", async () => {
    const context = createMockSkillContext({ requestId: "req-123" });
    const result = await executor.execute("test_skill", context, { input: "test" });

    expect(result.result.toolCallId).toBe("call-req-123");
    expect(result.result.toolName).toBe("test_skill");
    expect(typeof result.result.content).toBe("string");
  });
});

describe("SearchKnowledgeSkill", () => {
  let skill: SearchKnowledgeSkill;
  let mockRAGEngine: Partial<RAGEngine>;

  beforeEach(() => {
    mockRAGEngine = createMockRAGEngine();
    skill = createSearchKnowledgeSkill(mockRAGEngine as RAGEngine);
  });

  it("has correct metadata", () => {
    expect(skill.name).toBe("search_knowledge");
    expect(skill.permissions).toEqual(["public"]);
    expect(skill.metadata?.category).toBe("knowledge");
  });

  it("validates required query parameter", () => {
    expect(() => skill.validate({})).toThrow();
    expect(() => skill.validate({ query: "" })).toThrow();
    expect(() => skill.validate({ query: "test query" })).not.toThrow();
  });

  it("applies default values", () => {
    const validated = skill.validate({ query: "test" });
    expect(validated.topK).toBe(5);
    expect(validated.similarityThreshold).toBe(0.7);
  });

  it("executes search via RAG engine", async () => {
    const context = createMockSkillContext();
    const result = await skill.execute(context, { query: "WebXIA services" });

    expect(result.success).toBe(true);
    expect(result.data?.results).toHaveLength(1);
    expect(result.data?.results[0].title).toBe("Test Doc");
    expect(result.data?.totalFound).toBe(1);
    expect(mockRAGEngine.query).toHaveBeenCalledWith(
      "WebXIA services",
      expect.objectContaining({
        topK: 5,
        similarityThreshold: 0.7,
        sessionId: "session-1",
        userId: "user-1",
      }),
    );
  });

  it("passes custom options to RAG engine", async () => {
    const context = createMockSkillContext();
    await skill.execute(context, {
      query: "test",
      topK: 10,
      similarityThreshold: 0.9,
      filters: { locale: "en" },
    });

    expect(mockRAGEngine.query).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        topK: 10,
        similarityThreshold: 0.9,
        metadataFilters: { locale: "en" },
      }),
    );
  });

  it("returns citations", async () => {
    const context = createMockSkillContext();
    const result = await skill.execute(context, { query: "test" });

    expect(result.citations).toBeDefined();
    expect(result.citations?.length).toBeGreaterThan(0);
  });

  it("propagates distinct document/chunk identities to results and citations", async () => {
    const context = createMockSkillContext();
    const result = await skill.execute(context, { query: "test" });

    expect(result.data?.results[0]).toMatchObject({
      documentId: "doc-1",
      chunkId: "chunk-1",
      chunkIndex: 0,
    });
    expect(result.citations?.[0]).toMatchObject({
      documentId: "doc-1",
      chunkId: "chunk-1",
    });
  });

  it("handles RAG engine errors gracefully", async () => {
    mockRAGEngine.query = vi.fn().mockRejectedValue(new Error("RAG failed"));
    const context = createMockSkillContext();
    const result = await skill.execute(context, { query: "test" });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("EXECUTION_FAILED");
    expect(result.error?.recoverable).toBe(true);
  });
});

describe("SummarizeSkill", () => {
  let skill: SummarizeSkill;
  let mockLLMProvider: Partial<LLMProvider>;

  beforeEach(() => {
    mockLLMProvider = createMockLLMProvider();
    skill = createSummarizeSkill(mockLLMProvider as LLMProvider, "test-model");
  });

  it("has correct metadata", () => {
    expect(skill.name).toBe("summarize");
    expect(skill.permissions).toEqual(["public"]);
    expect(skill.metadata?.category).toBe("utility");
  });

  it("validates required text parameter", () => {
    expect(() => skill.validate({})).toThrow();
    expect(() => skill.validate({ text: "" })).toThrow();
    expect(() => skill.validate({ text: "Valid text" })).not.toThrow();
  });

  it("applies default values", () => {
    const validated = skill.validate({ text: "Test text" });
    expect(validated.maxLength).toBe(500);
    expect(validated.style).toBe("concise");
  });

  it("executes summarization via LLM provider", async () => {
    const context = createMockSkillContext();
    const longText = "This is a long text that needs to be summarized. ".repeat(20);

    const result = await skill.execute(context, { text: longText });

    expect(result.success).toBe(true);
    expect(result.data?.summary).toBe("This is a test summary.");
    expect(result.data?.originalLength).toBe(longText.length);
    expect(result.data?.compressionRatio).toBeLessThan(1);
    expect(mockLLMProvider.complete).toHaveBeenCalled();
  });

  it("passes style and focus to system prompt", async () => {
    const context = createMockSkillContext();
    await skill.execute(context, {
      text: "Test text",
      style: "bullet-points",
      focus: "pricing",
      maxLength: 200,
    });

    expect(mockLLMProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        maxTokens: 200,
        temperature: 0.3,
      }),
    );
  });

  it("handles LLM provider errors gracefully", async () => {
    mockLLMProvider.complete = vi.fn().mockRejectedValue(new Error("LLM failed"));
    const context = createMockSkillContext();
    const result = await skill.execute(context, { text: "Test text" });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("EXECUTION_FAILED");
    expect(result.error?.recoverable).toBe(true);
  });

  it("respects text length limits", () => {
    const longText = "x".repeat(60000);
    expect(() => skill.validate({ text: longText })).toThrow();
  });
});

describe("Skill Integration", () => {
  let executor: SkillExecutor;
  let mockRAGEngine: Partial<RAGEngine>;
  let mockLLMProvider: Partial<LLMProvider>;

  beforeEach(() => {
    skillRegistry.clear();

    mockRAGEngine = createMockRAGEngine();
    mockLLMProvider = createMockLLMProvider();

    const searchSkill = createSearchKnowledgeSkill(mockRAGEngine as RAGEngine);
    const summarizeSkill = createSummarizeSkill(mockLLMProvider as LLMProvider, "test-model");

    registerSkill(searchSkill);
    registerSkill(summarizeSkill);

    executor = new SkillExecutor();
  });

  it("registers both skills and provides tool definitions", () => {
    const defs = getAllToolDefinitions();
    expect(defs.length).toBe(2);
    expect(defs.map((d) => d.function.name).sort()).toEqual(["search_knowledge", "summarize"]);
  });

  it("executes search_knowledge then summarize in sequence", async () => {
    const context = createMockSkillContext();

    const searchResult = await executor.execute("search_knowledge", context, {
      query: "WebXIA pricing",
    });
    expect(searchResult.result.success).toBe(true);

    const summaryResult = await executor.execute("summarize", context, {
      text: searchResult.result.content,
      style: "concise",
    });
    expect(summaryResult.result.success).toBe(true);
  });
});
