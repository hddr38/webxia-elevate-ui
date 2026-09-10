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
import { handleChatRequest } from "./chat";

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
