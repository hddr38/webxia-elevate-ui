import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventBus } from "@/lib/ai/events";

vi.mock("@/lib/ai/conversation/conversation-service", () => {
  class ConversationNotFoundError extends Error {
    conversationId: string;
    constructor(conversationId: string) {
      super("Conversation not found");
      this.name = "ConversationNotFoundError";
      this.conversationId = conversationId;
    }
  }
  return {
    ConversationNotFoundError,
    getOrCreateConversation: vi.fn(async () => ({ id: "conv-1", sessionId: "session-1" })),
    getConversationHistory: vi.fn(async () => []),
    addMessage: vi.fn(
      async (
        _ctx: unknown,
        _conversationId: string,
        input: { role: "user" | "assistant"; content: string },
      ) => ({ id: `m-${input.role}`, role: input.role, content: input.content, timestamp: 1 }),
    ),
  };
});

vi.mock("@/lib/ai/agent/orchestrator", () => ({
  AgentOrchestrator: vi.fn().mockImplementation(() => ({
    run: vi.fn(
      async (opts: {
        onStream?: (e: unknown) => void;
        conversationId: string;
        requestId: string;
      }) => {
        opts.onStream?.({
          type: "text_delta",
          data: { content: "hi", index: 0 },
          timestamp: 1,
          conversationId: opts.conversationId,
          requestId: opts.requestId,
        });
        return {
          finalResponse: "hi",
          messages: [],
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          finishReason: "stop",
          steps: 1,
          toolCallCount: 0,
          durationMs: 5,
          errors: [],
        };
      },
    ),
  })),
}));

import {
  addMessage,
  getConversationHistory,
  getOrCreateConversation,
} from "@/lib/ai/conversation/conversation-service";
import { AgentOrchestrator } from "@/lib/ai/agent/orchestrator";
import { handleChatRequest, resolveChatTimeoutMs } from "./chat";

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    request: new Request("http://localhost/api/chat", { method: "POST" }),
    user: null,
    sanitizedBody: {
      message: "hello",
      sessionId: "11111111-1111-1111-1111-111111111111",
      locale: "fr",
      ...overrides,
    },
    requestId: "22222222-2222-2222-2222-222222222222",
  };
}

async function readSse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("no body");
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe("handleChatRequest instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it("streams SSE with x-request-id and emits bus events with one requestId", async () => {
    const seen: Array<{ type: string; requestId: string }> = [];
    eventBus.onAny((event) => {
      seen.push({ type: event.type, requestId: event.requestId });
    });

    const response = await handleChatRequest(ctx());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("x-request-id")).toBe("22222222-2222-2222-2222-222222222222");

    const text = await readSse(response);
    expect(text).toContain('"type":"message_start"');
    expect(text).toContain('"type":"text_delta"');
    expect(text).toContain('"type":"message_complete"');

    // user persisted before the run, assistant after — same conversation.
    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(addMessage).mock.calls[0][2]).toMatchObject({
      role: "user",
      content: "hello",
    });
    expect(vi.mocked(addMessage).mock.calls[1][2]).toMatchObject({
      role: "assistant",
      content: "hi",
    });

    const types = seen.map((e) => e.type);
    expect(types).toContain("agent.message.received");
    expect(types).toContain("agent.response.completed");
    for (const e of seen) expect(e.requestId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("rejects missing sessionId with 401", async () => {
    const c = ctx();
    delete (c.sanitizedBody as Record<string, unknown>).sessionId;
    await expect(handleChatRequest(c)).rejects.toMatchObject({ status: 401 });
    expect(getOrCreateConversation).not.toHaveBeenCalled();
  });

  it("rejects malformed sessionId with 401", async () => {
    await expect(handleChatRequest(ctx({ sessionId: "not-a-uuid" }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("maps foreign conversationId to 403 (never existence leak)", async () => {
    const { ConversationNotFoundError } =
      await import("@/lib/ai/conversation/conversation-service");
    vi.mocked(getConversationHistory).mockRejectedValueOnce(
      new ConversationNotFoundError("conv-x"),
    );

    await expect(
      handleChatRequest(ctx({ conversationId: "33333333-3333-3333-3333-333333333333" })),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("resolveChatTimeoutMs", () => {
  it("defaults to 60s for missing or invalid env values", () => {
    expect(resolveChatTimeoutMs(undefined)).toBe(60000);
    expect(resolveChatTimeoutMs("not-a-number")).toBe(60000);
    expect(resolveChatTimeoutMs("")).toBe(60000);
    expect(resolveChatTimeoutMs("   ")).toBe(60000);
  });

  it("clamps configured values to [5s, 300s]", () => {
    expect(resolveChatTimeoutMs("1000")).toBe(5000);
    expect(resolveChatTimeoutMs("15000")).toBe(15000);
    expect(resolveChatTimeoutMs("999999")).toBe(300000);
  });
});

describe("handleChatRequest generation failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it("emits SSE error GENERATION_FAILED, persists no assistant message, closes the stream", async () => {
    const seen: string[] = [];
    eventBus.onAny((event) => {
      seen.push(event.type);
    });

    vi.mocked(AgentOrchestrator).mockImplementationOnce(
      () =>
        ({
          run: () =>
            Promise.reject(
              Object.assign(new Error("LLM generation failed — no response produced"), {
                code: "GENERATION_FAILED",
                recoverable: true,
                details: { cause: "PROVIDER_UNAVAILABLE" },
              }),
            ),
        }) as unknown as InstanceType<typeof AgentOrchestrator>,
    );

    const response = await handleChatRequest(ctx());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    // readSse resolves only once the stream is closed — no dangling stream.
    const text = await readSse(response);
    expect(text).toContain('"type":"message_start"');
    expect(text).toContain('"type":"error"');
    expect(text).toContain('"code":"GENERATION_FAILED"');
    expect(text).toContain('"recoverable":true');
    expect(text).not.toContain('"type":"message_complete"');

    // Only the user message is persisted — a failed generation never writes
    // an assistant reply (no history replay ends up in the conversation).
    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addMessage).mock.calls[0][2]).toMatchObject({ role: "user" });

    expect(seen).toContain("agent.message.received");
    expect(seen).not.toContain("agent.response.completed");
  });
});

describe("handleChatRequest lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it("fails fast with 499 when the client already disconnected", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      signal: controller.signal,
    });

    await expect(handleChatRequest({ ...ctx(), request })).rejects.toMatchObject({
      status: 499,
    });
  });

  it("emits GLOBAL_TIMEOUT and closes the stream when the deadline expires", async () => {
    const previous = process.env.CHAT_REQUEST_TIMEOUT_MS;
    process.env.CHAT_REQUEST_TIMEOUT_MS = "5000";
    try {
      vi.mocked(AgentOrchestrator).mockImplementationOnce(
        () =>
          ({
            run: () => new Promise(() => undefined),
          }) as unknown as InstanceType<typeof AgentOrchestrator>,
      );

      const response = await handleChatRequest(ctx());
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");

      const text = await readSse(response);
      expect(text).toContain('"type":"message_start"');
      expect(text).toContain('"type":"error"');
      expect(text).toContain('"code":"GLOBAL_TIMEOUT"');
      expect(text).toContain('"recoverable":true');
      expect(text).not.toContain('"type":"message_complete"');
    } finally {
      if (previous === undefined) delete process.env.CHAT_REQUEST_TIMEOUT_MS;
      else process.env.CHAT_REQUEST_TIMEOUT_MS = previous;
    }
  }, 15000);
});
