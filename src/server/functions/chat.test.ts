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
import { handleChatRequest, resolveChatHeartbeatMs, resolveChatTimeoutMs } from "./chat";

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
  return openSse(response).readAll();
}

/** Keeps the reader alive so a test can read until a point, act, then drain. */
function openSse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("no body");
  const decoder = new TextDecoder();
  let text = "";
  return {
    get text(): string {
      return text;
    },
    async readUntil(predicate: (acc: string) => boolean): Promise<string> {
      while (!predicate(text)) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      return text;
    },
    async readAll(): Promise<string> {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      return text;
    },
    /** Tears the stream down (fires `cancel()` on the server side). */
    async cancel(): Promise<void> {
      await reader.cancel().catch(() => undefined);
    },
  };
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

    // every frame carries a monotonic SSE sequence id (additive to `data:`)
    expect(text).toContain("id: 1\ndata:");
    expect(text).toContain("id: 2\ndata:");
    expect(text).toContain("id: 3\ndata:");
    expect(text).not.toContain("id: 4\ndata:");

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

describe("resolveChatHeartbeatMs", () => {
  it("defaults to 15s for missing or invalid env values", () => {
    expect(resolveChatHeartbeatMs(undefined)).toBe(15000);
    expect(resolveChatHeartbeatMs("not-a-number")).toBe(15000);
    expect(resolveChatHeartbeatMs("")).toBe(15000);
    expect(resolveChatHeartbeatMs("   ")).toBe(15000);
  });

  it("clamps configured values to [250ms, 60s]", () => {
    expect(resolveChatHeartbeatMs("1")).toBe(250);
    expect(resolveChatHeartbeatMs("250")).toBe(250);
    expect(resolveChatHeartbeatMs("4000")).toBe(4000);
    expect(resolveChatHeartbeatMs("999999")).toBe(60000);
  });
});

describe("handleChatRequest SSE keep-alive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it("emits a heartbeat comment while the run is stalled, then no more after close", async () => {
    const previous = process.env.CHAT_HEARTBEAT_MS;
    process.env.CHAT_HEARTBEAT_MS = "250";
    try {
      vi.mocked(AgentOrchestrator).mockImplementationOnce(
        () =>
          ({
            run: () => new Promise(() => undefined),
          }) as unknown as InstanceType<typeof AgentOrchestrator>,
      );

      const response = await handleChatRequest(ctx());
      const stream = openSse(response);
      let text = "";
      try {
        text = await stream.readUntil((acc) => acc.includes(": hb"));
      } finally {
        await stream.cancel();
      }

      expect(text).toContain(": hb ");
      expect(text).toContain('"type":"message_start"');
      // the comment never leaks into the `data:` channel
      expect(text).not.toContain("data: : hb");
    } finally {
      if (previous === undefined) delete process.env.CHAT_HEARTBEAT_MS;
      else process.env.CHAT_HEARTBEAT_MS = previous;
    }
  }, 15000);

  it("stays silent while frames are flowing (heartbeat only covers idle gaps)", async () => {
    const previous = process.env.CHAT_HEARTBEAT_MS;
    process.env.CHAT_HEARTBEAT_MS = "250";
    try {
      vi.mocked(AgentOrchestrator).mockImplementationOnce(
        () =>
          ({
            run: async (opts: StreamOpts) => {
              // 8 deltas at ~40ms = ~320ms of continuous production, longer
              // than the heartbeat window but with no idle gap.
              for (let i = 0; i < 8; i++) {
                await new Promise<void>((resolve) => setTimeout(resolve, 40));
                await opts.onStream?.(delta(`t${i} `, opts));
              }
              return {
                finalResponse: "t0 t1 t2 t3 t4 t5 t6 t7 ",
                messages: [],
                toolCalls: [],
                toolResults: [],
                usage: { promptTokens: 1, completionTokens: 8, totalTokens: 9 },
                finishReason: "stop",
                steps: 1,
                toolCallCount: 0,
                durationMs: 320,
                errors: [],
              };
            },
          }) as unknown as InstanceType<typeof AgentOrchestrator>,
      );

      const text = await readSse(await handleChatRequest(ctx()));
      expect(text).toContain('"type":"message_complete"');
      expect(text).not.toContain(": hb ");
    } finally {
      if (previous === undefined) delete process.env.CHAT_HEARTBEAT_MS;
      else process.env.CHAT_HEARTBEAT_MS = previous;
    }
  }, 15000);
});

type StreamOpts = {
  onStream?: (event: unknown) => void | Promise<void>;
  conversationId: string;
  requestId: string;
};

function delta(content: string, opts: StreamOpts) {
  return {
    type: "text_delta",
    data: { content, index: 0 },
    timestamp: 1,
    conversationId: opts.conversationId,
    requestId: opts.requestId,
  };
}

describe("handleChatRequest partial content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it("persists what the user already read when the client disconnects mid-stream", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      signal: controller.signal,
    });

    vi.mocked(AgentOrchestrator).mockImplementationOnce(
      () =>
        ({
          run: async (opts: StreamOpts) => {
            await opts.onStream?.(delta("bonjour ", opts));
            return new Promise(() => undefined);
          },
        }) as unknown as InstanceType<typeof AgentOrchestrator>,
    );

    const response = await handleChatRequest({ ...ctx(), request });
    const stream = openSse(response);
    const seen = await stream.readUntil((acc) => acc.includes('"content":"bonjour "'));
    expect(seen).toContain('"type":"text_delta"');

    controller.abort();
    const rest = await stream.readAll();
    expect(rest).toContain('"type":"error"');
    expect(rest).not.toContain('"type":"message_complete"');

    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(addMessage).mock.calls[1][2]).toMatchObject({
      role: "assistant",
      content: "bonjour ",
    });
  });

  it("still never persists an assistant row on GENERATION_FAILED, even after deltas", async () => {
    vi.mocked(AgentOrchestrator).mockImplementationOnce(
      () =>
        ({
          run: async (opts: StreamOpts) => {
            await opts.onStream?.(delta("debut ", opts));
            throw Object.assign(new Error("LLM generation failed — no response produced"), {
              code: "GENERATION_FAILED",
              recoverable: true,
            });
          },
        }) as unknown as InstanceType<typeof AgentOrchestrator>,
    );

    const response = await handleChatRequest(ctx());
    const text = await readSse(response);
    expect(text).toContain('"code":"GENERATION_FAILED"');
    expect(text).toContain('"content":"debut "');
    expect(text).not.toContain('"type":"message_complete"');

    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addMessage).mock.calls[0][2]).toMatchObject({ role: "user" });
  });
});

describe("handleChatRequest retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it("skips the duplicate user write when isRetry targets an existing conversation", async () => {
    const response = await handleChatRequest(
      ctx({ isRetry: true, conversationId: "33333333-3333-3333-3333-333333333333" }),
    );
    const text = await readSse(response);
    expect(text).toContain('"type":"message_complete"');

    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addMessage).mock.calls[0][2]).toMatchObject({ role: "assistant" });
  });

  it("still writes the user message on the first attempt", async () => {
    const response = await handleChatRequest(ctx());
    await readSse(response);

    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(addMessage).mock.calls[0][2]).toMatchObject({ role: "user" });
    expect(vi.mocked(addMessage).mock.calls[1][2]).toMatchObject({ role: "assistant" });
  });
});
