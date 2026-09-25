import { describe, it, expect, vi, beforeEach } from "vitest";

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
    getConversationHistory: vi.fn(async () => []),
    getOrCreateConversation: vi.fn(async () => ({ id: "conv-1", sessionId: "session-1" })),
    addMessage: vi.fn(async () => ({
      id: "m-1",
      role: "user",
      content: "x",
      timestamp: 1,
    })),
  };
});

vi.mock("@/lib/ai/security/audit-log", () => ({
  auditLogger: {
    logAuthFailure: vi.fn(async () => undefined),
    logSecurityEvent: vi.fn(async () => undefined),
    logRateLimitExceeded: vi.fn(async () => undefined),
    logValidationFailure: vi.fn(async () => undefined),
    logPromptInjection: vi.fn(async () => undefined),
  },
}));

import { auditLogger } from "@/lib/ai/security/audit-log";
import {
  ConversationNotFoundError,
  getConversationHistory,
} from "@/lib/ai/conversation/conversation-service";
import {
  handleChatHistoryRequest,
  normalizeHistoryLimit,
  toChatHistoryMessage,
  type ChatHistoryHandlerContext,
} from "./chat-history";

const SESSION = "11111111-1111-1111-1111-111111111111";
const CONV = "33333333-3333-3333-3333-333333333333";

function ctx(overrides: Record<string, unknown> = {}): ChatHistoryHandlerContext {
  return {
    request: new Request("http://localhost/api/chat-history", { method: "POST" }),
    user: null,
    input: {
      sessionId: SESSION,
      conversationId: CONV,
      ...overrides,
    } as ChatHistoryHandlerContext["input"],
    requestId: "22222222-2222-2222-2222-222222222222",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleChatHistoryRequest session validation", () => {
  it("rejects missing sessionId with 401 + audit and never queries history", async () => {
    const c = ctx();
    delete c.input.sessionId;
    await expect(handleChatHistoryRequest(c)).rejects.toMatchObject({ status: 401 });
    expect(getConversationHistory).not.toHaveBeenCalled();
    expect(auditLogger.logAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed sessionId with 401 (never a 400 or 500)", async () => {
    await expect(handleChatHistoryRequest(ctx({ sessionId: "not-a-uuid" }))).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      handleChatHistoryRequest(ctx({ sessionId: 123 as unknown as string })),
    ).rejects.toMatchObject({ status: 401 });
    await expect(handleChatHistoryRequest(ctx({ sessionId: "" }))).rejects.toMatchObject({
      status: 401,
    });
    expect(getConversationHistory).not.toHaveBeenCalled();
  });

  it("rejects missing conversationId with 400 and never queries history", async () => {
    const c = ctx();
    delete c.input.conversationId;
    await expect(handleChatHistoryRequest(c)).rejects.toMatchObject({ status: 400 });
    expect(getConversationHistory).not.toHaveBeenCalled();
  });

  it("rejects malformed conversationId with 400 (never a 500)", async () => {
    await expect(
      handleChatHistoryRequest(ctx({ conversationId: "../../etc/passwd" })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      handleChatHistoryRequest(ctx({ conversationId: null as unknown as string })),
    ).rejects.toMatchObject({ status: 400 });
    expect(getConversationHistory).not.toHaveBeenCalled();
  });
});

describe("handleChatHistoryRequest session isolation", () => {
  it("maps foreign conversationId to 403 + audit (never existence leak)", async () => {
    vi.mocked(getConversationHistory).mockRejectedValueOnce(
      new ConversationNotFoundError("conv-x"),
    );

    await expect(handleChatHistoryRequest(ctx())).rejects.toMatchObject({ status: 403 });

    // Audit carries the ids but the HTTP body never does.
    expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
      "permission_denied",
      expect.objectContaining({
        severity: "high",
        sessionId: SESSION,
        conversationId: CONV,
        requestId: "22222222-2222-2222-2222-222222222222",
      }),
    );
  });

  it("passes the CALLER's sessionId to the service — never another session's", async () => {
    vi.mocked(getConversationHistory).mockResolvedValueOnce([]);

    await handleChatHistoryRequest(ctx({ sessionId: SESSION }));

    expect(getConversationHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, userId: undefined }),
      CONV,
      50,
    );
  });

  it("scopes the service query by session_id (ADR-006: ownership enforced on every query)", async () => {
    vi.mocked(getConversationHistory).mockResolvedValueOnce([]);

    await handleChatHistoryRequest(ctx({ sessionId: "99999999-9999-9999-9999-999999999999" }));

    const call = vi.mocked(getConversationHistory).mock.calls.at(-1);
    expect(call?.[0]?.sessionId).toBe("99999999-9999-9999-9999-999999999999");
    // A different session id than the attacker one is never substituted.
    expect(call?.[0]?.sessionId).not.toBe(SESSION);
  });

  it("does not treat an unexpected service error as ownership failure (rethrows)", async () => {
    vi.mocked(getConversationHistory).mockRejectedValueOnce(new Error("Database down"));

    await expect(handleChatHistoryRequest(ctx())).rejects.toThrow("Database down");
    expect(auditLogger.logSecurityEvent).not.toHaveBeenCalledWith(
      "permission_denied",
      expect.anything(),
    );
  });
});

describe("handleChatHistoryRequest response mapping", () => {
  it("returns mapped messages and drops system turns (server scaffolding never leaks)", async () => {
    vi.mocked(getConversationHistory).mockResolvedValueOnce([
      { id: "m-1", role: "user", content: "hi", timestamp: 1 },
      { id: "m-2", role: "assistant", content: "hello", timestamp: 2 },
      { id: "m-3", role: "system", content: "SECRET PROMPT", timestamp: 3 },
      {
        id: "m-4",
        role: "tool",
        content: "{}",
        timestamp: 4,
        toolCallId: "call-1",
        toolName: "search",
      },
    ]);

    const messages = await handleChatHistoryRequest(ctx());

    expect(messages).toHaveLength(3);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
    expect(messages[1]).toMatchObject({ role: "assistant", content: "hello", timestamp: 2 });
    expect(messages[2]).toMatchObject({ role: "tool", toolName: "search", toolCallId: "call-1" });
    expect(JSON.stringify(messages)).not.toContain("SECRET PROMPT");
  });

  it("returns an empty array for an empty transcript (no null/undefined entries)", async () => {
    vi.mocked(getConversationHistory).mockResolvedValueOnce([]);

    const messages = await handleChatHistoryRequest(ctx());

    expect(messages).toEqual([]);
  });

  it("clamps out-of-range limits instead of forwarding them (defense-in-depth)", async () => {
    vi.mocked(getConversationHistory).mockResolvedValueOnce([]);

    await handleChatHistoryRequest(ctx({ limit: 100000 }));
    expect(getConversationHistory).toHaveBeenLastCalledWith(expect.anything(), CONV, 200);

    await handleChatHistoryRequest(ctx({ limit: -5 }));
    expect(getConversationHistory).toHaveBeenLastCalledWith(expect.anything(), CONV, 1);

    await handleChatHistoryRequest(ctx({ limit: "50" as unknown as number }));
    expect(getConversationHistory).toHaveBeenLastCalledWith(expect.anything(), CONV, 50);
  });

  it("forwards an authenticated userId to the service context (never widens ownership)", async () => {
    vi.mocked(getConversationHistory).mockResolvedValueOnce([]);

    const c = ctx();
    c.user = { id: "user-1", email: "a@b.c", role: "authenticated", adminId: "" };

    await handleChatHistoryRequest(c);

    const call = vi.mocked(getConversationHistory).mock.calls.at(-1);
    expect(call?.[0]?.userId).toBe("user-1");
    // Ownership still rides on the caller's session id, not on the user id.
    expect(call?.[0]?.sessionId).toBe(SESSION);
  });
});

describe("toChatHistoryMessage", () => {
  it("maps every renderable role and nulls system", () => {
    expect(
      toChatHistoryMessage({ id: "1", role: "user", content: "a", timestamp: 1 }),
    ).toMatchObject({
      role: "user",
      content: "a",
    });
    expect(
      toChatHistoryMessage({
        id: "2",
        role: "tool",
        content: "b",
        timestamp: 2,
        toolName: "t",
        toolCallId: "c",
      }),
    ).toMatchObject({ role: "tool", toolName: "t", toolCallId: "c" });
    expect(
      toChatHistoryMessage({ id: "3", role: "system", content: "c", timestamp: 3 }),
    ).toBeNull();
  });
});

describe("normalizeHistoryLimit", () => {
  it("defaults, clamps and floors", () => {
    expect(normalizeHistoryLimit(undefined)).toBe(50);
    expect(normalizeHistoryLimit(Number.NaN)).toBe(50);
    expect(normalizeHistoryLimit(1)).toBe(1);
    expect(normalizeHistoryLimit(7.9)).toBe(7);
    expect(normalizeHistoryLimit(1000)).toBe(200);
  });
});
