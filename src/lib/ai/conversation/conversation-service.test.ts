import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ConversationNotFoundError,
  addMessage,
  getConversationHistory,
  getLastNMessages,
  getOrCreateConversation,
  updateConversationStatus,
} from "../conversation/conversation-service";

interface DbResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

function createChainMock(queue: DbResponse[]) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = {
    then: (resolve: (v: DbResponse) => void) =>
      resolve(queue.shift() ?? { data: null, error: null }),
  };
  for (const m of [
    "select",
    "eq",
    "order",
    "limit",
    "range",
    "insert",
    "update",
    "delete",
    "single",
    "maybeSingle",
  ]) {
    calls[m] = [];
    builder[m] = vi.fn((...args: unknown[]) => {
      (calls[m] as unknown[][]).push(args);
      return builder;
    });
  }
  return { builder, calls };
}

function mockClient(queue: DbResponse[]) {
  const chains: ReturnType<typeof createChainMock>[] = [];
  const fromMock = vi.fn((_table: string) => {
    const chain = createChainMock(queue);
    chains.push(chain);
    return chain.builder;
  });
  const client = { from: fromMock } as unknown as SupabaseClient<Database>;
  vi.mocked(getSupabaseAdmin).mockReturnValue(client as never);
  return { fromMock, chains };
}

const CONV_ROW = {
  id: "conv-1",
  session_id: "session-1",
  status: "active",
  metadata: {},
  created_at: "2026-09-09T10:00:00Z",
  updated_at: "2026-09-09T10:00:00Z",
};

function msgRow(role: string, content: string, i: number) {
  return {
    id: `msg-${i}`,
    conversation_id: "conv-1",
    role,
    content,
    tool_calls: null,
    tool_call_id: null,
    tool_name: null,
    metadata: {},
    created_at: `2026-09-09T10:00:0${i}Z`,
  };
}

describe("conversation-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getOrCreateConversation returns the existing active conversation", async () => {
    const { fromMock } = mockClient([{ data: CONV_ROW, error: null }]);

    const conv = await getOrCreateConversation({ sessionId: "session-1" });

    expect(conv.id).toBe("conv-1");
    expect(conv.sessionId).toBe("session-1");
    expect(conv.status).toBe("active");
    expect(fromMock).toHaveBeenCalledWith("conversations");
  });

  it("getOrCreateConversation creates when none exists", async () => {
    mockClient([
      { data: null, error: null },
      { data: CONV_ROW, error: null },
    ]);

    const conv = await getOrCreateConversation({ sessionId: "session-1" });

    expect(conv.id).toBe("conv-1");
  });

  it("getOrCreateConversation is idempotent on 23505 race (re-selects winner)", async () => {
    const { chains } = mockClient([
      { data: null, error: null },
      { data: null, error: { message: "duplicate", code: "23505" } },
      { data: CONV_ROW, error: null },
    ]);

    const conv = await getOrCreateConversation({ sessionId: "session-1" });

    expect(conv.id).toBe("conv-1");
    // select → insert → re-select
    expect(chains.length).toBe(3);
  });

  it("foreign sessionId looks missing, never forbidden", async () => {
    mockClient([{ data: null, error: null }]);

    await expect(
      getConversationHistory({ sessionId: "attacker" }, "conv-1"),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it("getConversationHistory returns mapped messages in order", async () => {
    mockClient([
      { data: { id: "conv-1" }, error: null },
      { data: [msgRow("user", "hi", 1), msgRow("assistant", "hello", 2)], error: null },
    ]);

    const history = await getConversationHistory({ sessionId: "session-1" }, "conv-1");

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ role: "user", content: "hi" });
    expect(history[1]).toMatchObject({ role: "assistant", content: "hello" });
  });

  it("getConversationHistory maps tool messages with call ids", async () => {
    mockClient([
      { data: { id: "conv-1" }, error: null },
      {
        data: [{ ...msgRow("tool", "{}", 1), tool_call_id: "call-1", tool_name: "search" }],
        error: null,
      },
    ]);

    const history = await getConversationHistory({ sessionId: "session-1" }, "conv-1");

    expect(history[0]).toMatchObject({ role: "tool", toolCallId: "call-1", toolName: "search" });
  });

  it("getLastNMessages returns the N most recent in ascending order", async () => {
    mockClient([
      { data: { id: "conv-1" }, error: null },
      {
        data: [msgRow("assistant", "third", 3), msgRow("user", "second", 2)],
        error: null,
      },
    ]);

    const last = await getLastNMessages({ sessionId: "session-1" }, "conv-1", 2);

    expect(last.map((m) => m.content)).toEqual(["second", "third"]);
  });

  it("addMessage inserts with role/content and returns the mapped message", async () => {
    const { chains } = mockClient([
      { data: { id: "conv-1" }, error: null },
      { data: msgRow("user", "hello", 1), error: null },
    ]);

    const msg = await addMessage({ sessionId: "session-1" }, "conv-1", {
      role: "user",
      content: "hello",
    });

    expect(msg).toMatchObject({ role: "user", content: "hello" });
    // updated_at is bumped by the Postgres trigger — a single insert, no follow-up update.
    const insertCalls = chains[1].calls.insert as unknown[][];
    expect(insertCalls[0][0]).toMatchObject({
      conversation_id: "conv-1",
      role: "user",
      content: "hello",
    });
    expect(chains[1].calls.update as unknown[][]).toHaveLength(0);
  });

  it("addMessage on a foreign conversation looks missing", async () => {
    mockClient([{ data: null, error: null }]);

    await expect(
      addMessage({ sessionId: "attacker" }, "conv-1", { role: "user", content: "x" }),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it("updateConversationStatus scopes by session and throws when missing", async () => {
    const { chains } = mockClient([{ data: [{ id: "conv-1" }], error: null }]);

    await updateConversationStatus({ sessionId: "session-1" }, "conv-1", "closed");

    const updateCalls = chains[0].calls.update as unknown[][];
    expect(updateCalls[0][0]).toMatchObject({ status: "closed" });
    const eqCalls = chains[0].calls.eq as unknown[][];
    expect(eqCalls).toContainEqual(["id", "conv-1"]);
    expect(eqCalls).toContainEqual(["session_id", "session-1"]);

    mockClient([{ data: [], error: null }]);
    await expect(
      updateConversationStatus({ sessionId: "session-1" }, "conv-1", "closed"),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });
});
