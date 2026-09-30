import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

// ADR-006 regression guard: the anon/cookie SSR client must never come back
// here (its RLS never matched: no `session_id` claim with the modern sb_* keys).
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => {
    throw new Error("createSupabaseServerClient must not be used (ADR-006)");
  }),
}));

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveSessionId,
  withConversationTitle,
  handleCreateConversation,
  handleGetConversation,
  handleListConversations,
  handleAppendMessage,
  handleListMessages,
  handleUpdateConversationStatus,
  handleDeleteConversation,
  type CreateConversationInput,
  type DeleteConversationInput,
  type GetConversationInput,
  type ListConversationsInput,
  type AppendMessageInput,
  type ListMessagesInput,
  type UpdateConversationStatusInput,
} from "./conversations";

const SESSION = "11111111-1111-1111-1111-111111111111";
const OTHER_SESSION = "99999999-9999-9999-9999-999999999999";
const CONV = "33333333-3333-3333-3333-333333333333";

const CONVERSATION_ROW = {
  id: CONV,
  session_id: SESSION,
  status: "active",
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const MESSAGE_ROW = {
  id: "44444444-4444-4444-4444-444444444444",
  conversation_id: CONV,
  role: "user",
  content: "salut webi",
  tool_calls: null,
  tool_call_id: null,
  tool_name: null,
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

interface ChainLog {
  table: string;
  calls: Record<string, unknown[][]>;
}

const CHAIN_METHODS = [
  "select",
  "eq",
  "in",
  "order",
  "limit",
  "range",
  "insert",
  "update",
  "delete",
  "single",
  "maybeSingle",
] as const;

/**
 * Minimal PostgREST chain double: every builder method records its arguments
 * and returns the chain; awaiting the chain shifts the next queued result.
 * This mirrors supabase-js, where `.single()` / `.maybeSingle()` / `.range()`
 * all return a thenable builder.
 */
function mockSupabase(results: unknown[]): { chains: ChainLog[] } {
  const chains: ChainLog[] = [];
  const queue = [...results];

  const client = {
    from: (table: string) => {
      const calls: Record<string, unknown[][]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      for (const method of CHAIN_METHODS) {
        chain[method] = (...args: unknown[]) => {
          (calls[method] ??= []).push(args);
          return chain;
        };
      }
      chain.then = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
        const next = queue.length > 0 ? queue.shift() : { data: null, error: null, count: 0 };
        Promise.resolve(next).then(resolve, reject);
      };
      chains.push({ table, calls });
      return chain;
    },
  };

  vi.mocked(getSupabaseAdmin).mockReturnValue(
    client as unknown as ReturnType<typeof getSupabaseAdmin>,
  );
  return { chains };
}

/**
 * A query is "scoped" when the session id appears either as an `.eq` filter
 * or inside the inserted payload (the insert carries ownership by design).
 */
function scopedBySession(chain: ChainLog, sessionId = SESSION): boolean {
  const viaEq = (chain.calls.eq ?? []).some(
    ([column, value]) => column === "session_id" && value === sessionId,
  );
  if (viaEq) return true;
  return (chain.calls.insert ?? []).some(([payload]) => {
    const body = payload as { session_id?: unknown } | undefined;
    return body?.session_id === sessionId;
  });
}

function tables(chains: ChainLog[]): string[] {
  return chains.map((chain) => chain.table);
}

/** Returns whatever the call threw (Response objects carry their own `status`). */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveSessionId", () => {
  it("returns a well-formed session id unchanged", () => {
    expect(resolveSessionId(SESSION)).toBe(SESSION);
  });

  it("rejects a missing session id with 401 (never 403, never a silent pass)", () => {
    expect(thrownBy(() => resolveSessionId(undefined))).toMatchObject({ status: 401 });
    expect(thrownBy(() => resolveSessionId(null))).toMatchObject({ status: 401 });
    expect(thrownBy(() => resolveSessionId(""))).toMatchObject({ status: 401 });
  });

  it("rejects a malformed session id with 401", () => {
    expect(thrownBy(() => resolveSessionId("not-a-uuid"))).toMatchObject({ status: 401 });
    // Uppercase is fine, a non-UUID shape is not.
    expect(resolveSessionId(SESSION.toUpperCase())).toBe(SESSION.toUpperCase());
    expect(thrownBy(() => resolveSessionId(SESSION.replace(/-/g, "")))).toMatchObject({
      status: 401,
    });
    expect(thrownBy(() => resolveSessionId(123 as unknown as string))).toMatchObject({
      status: 401,
    });
  });
});

describe("withConversationTitle", () => {
  it("derives the title from the first user message", () => {
    const items = withConversationTitle(
      [{ id: CONV }],
      [
        { conversation_id: CONV, content: "first" },
        { conversation_id: CONV, content: "second" },
      ],
    );
    expect(items[0].title).toBe("first");
  });

  it("returns null when the conversation has no user message", () => {
    expect(withConversationTitle([{ id: CONV }], [])[0].title).toBeNull();
    expect(
      withConversationTitle([{ id: CONV }], [{ conversation_id: CONV, content: "   " }])[0].title,
    ).toBeNull();
  });

  it("never mixes titles across conversations", () => {
    const other = "55555555-5555-5555-5555-555555555555";
    const items = withConversationTitle(
      [{ id: CONV }, { id: other }],
      [
        { conversation_id: other, content: "from other" },
        { conversation_id: CONV, content: "from first" },
      ],
    );
    expect(items.map((item) => item.title)).toEqual(["from first", "from other"]);
  });
});

describe("handleListConversations", () => {
  const input: ListConversationsInput = { session_id: SESSION, page: 1, limit: 20 };

  it("scopes by session_id and orders by updated_at DESC (latest first)", async () => {
    const { chains } = mockSupabase([
      { data: [CONVERSATION_ROW], error: null, count: 1 },
      { data: [{ conversation_id: CONV, content: "salut webi" }], error: null },
    ]);

    const result = await handleListConversations(input);

    expect(tables(chains)).toEqual(["conversations", "messages"]);
    expect(scopedBySession(chains[0])).toBe(true);
    expect(chains[0].calls.order).toEqual([["updated_at", { ascending: false }]]);
    expect(chains[1].calls.eq).toContainEqual(["role", "user"]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
    expect(result.data[0]).toMatchObject({ id: CONV, title: "salut webi" });
  });

  it("skips the messages lookup entirely when there is no conversation", async () => {
    const { chains } = mockSupabase([{ data: [], error: null, count: 0 }]);

    const result = await handleListConversations(input);

    expect(chains).toHaveLength(1);
    expect(result.data).toEqual([]);
    expect(result.totalPages).toBe(0);
  });

  it("applies the optional status filter without dropping the session scope", async () => {
    const { chains } = mockSupabase([{ data: [], error: null, count: 0 }]);

    await handleListConversations({ ...input, status: "active" });

    expect(chains[0].calls.eq).toContainEqual(["status", "active"]);
    expect(scopedBySession(chains[0])).toBe(true);
  });

  it("surfaces a database error instead of returning a partial list", async () => {
    mockSupabase([{ data: null, error: { message: "boom" }, count: null }]);
    await expect(handleListConversations(input)).rejects.toThrow("boom");
  });
});

describe("handleCreateConversation", () => {
  const input: CreateConversationInput = { session_id: SESSION };

  it("archives the previous active conversation before inserting a new one", async () => {
    const { chains } = mockSupabase([{ error: null }, { data: CONVERSATION_ROW, error: null }]);

    const conversation = await handleCreateConversation(input);

    expect(tables(chains)).toEqual(["conversations", "conversations"]);
    // 1) archive: UPDATE scoped by session_id + status='active'
    expect(chains[0].calls.update).toEqual([[{ status: "archived" }]]);
    expect(chains[0].calls.eq).toEqual([
      ["session_id", SESSION],
      ["status", "active"],
    ]);
    // 2) insert: single ACTIVE row (uq_conversations_one_active_per_session),
    //    the session id rides in the payload itself.
    expect(chains[1].calls.insert).toEqual([
      [{ session_id: SESSION, metadata: {}, status: "active" }],
    ]);
    expect(conversation).toEqual(CONVERSATION_ROW);
  });

  it("adopts the concurrent winner on 23505 instead of surfacing the constraint error", async () => {
    const { chains } = mockSupabase([
      { error: null },
      { data: null, error: { message: "duplicate key", code: "23505" } },
      { data: CONVERSATION_ROW, error: null },
    ]);

    const conversation = await handleCreateConversation(input);

    expect(chains).toHaveLength(3);
    expect(chains[2].calls.eq).toEqual([
      ["session_id", SESSION],
      ["status", "active"],
    ]);
    expect(conversation).toEqual(CONVERSATION_ROW);
  });

  it("rethrows any other insert error", async () => {
    mockSupabase([{ error: null }, { data: null, error: { message: "insert failed" } }]);
    await expect(handleCreateConversation(input)).rejects.toThrow("insert failed");
  });

  it("never inserts without a resolved session id", async () => {
    const { chains } = mockSupabase([]);
    await expect(
      handleCreateConversation({ session_id: "bad" as unknown as string }),
    ).rejects.toMatchObject({ status: 401 });
    expect(chains).toHaveLength(0);
  });
});

describe("handleGetConversation", () => {
  const input: GetConversationInput = { session_id: SESSION, id: CONV };

  it("returns the conversation when the session owns it", async () => {
    const { chains } = mockSupabase([{ data: CONVERSATION_ROW, error: null }]);

    await expect(handleGetConversation(input)).resolves.toEqual(CONVERSATION_ROW);
    expect(scopedBySession(chains[0])).toBe(true);
  });

  it("maps a foreign conversation to 404 (never 403, no existence leak)", async () => {
    mockSupabase([{ data: null, error: null }]);
    await expect(handleGetConversation(input)).rejects.toMatchObject({ status: 404 });
  });
});

describe("handleAppendMessage", () => {
  const input: AppendMessageInput = {
    session_id: SESSION,
    conversation_id: CONV,
    role: "user",
    content: "salut",
  };

  it("checks ownership scoped by session_id, then inserts", async () => {
    const { chains } = mockSupabase([
      { data: { id: CONV }, error: null },
      { data: MESSAGE_ROW, error: null },
    ]);

    const message = await handleAppendMessage(input);

    expect(tables(chains)).toEqual(["conversations", "messages"]);
    expect(scopedBySession(chains[0])).toBe(true);
    expect(message).toEqual(MESSAGE_ROW);
  });

  it("stops at 404 for a foreign conversation and never writes a message", async () => {
    const { chains } = mockSupabase([{ data: null, error: null }]);

    await expect(handleAppendMessage(input)).rejects.toMatchObject({ status: 404 });
    expect(chains).toHaveLength(1);
  });
});

describe("handleListMessages", () => {
  const input: ListMessagesInput = {
    session_id: SESSION,
    conversation_id: CONV,
    page: 1,
    limit: 50,
  };

  it("lists messages of a conversation the session owns", async () => {
    const { chains } = mockSupabase([
      { data: { id: CONV }, error: null },
      { data: [MESSAGE_ROW], error: null, count: 1 },
    ]);

    const result = await handleListMessages(input);

    expect(tables(chains)).toEqual(["conversations", "messages"]);
    expect(scopedBySession(chains[0])).toBe(true);
    expect(result.total).toBe(1);
    expect(result.data).toEqual([MESSAGE_ROW]);
  });

  it("maps a foreign conversation to 404 without touching messages", async () => {
    const { chains } = mockSupabase([{ data: null, error: null }]);

    await expect(handleListMessages(input)).rejects.toMatchObject({ status: 404 });
    expect(chains).toHaveLength(1);
  });
});

describe("handleUpdateConversationStatus", () => {
  const input: UpdateConversationStatusInput = {
    session_id: SESSION,
    id: CONV,
    status: "archived",
  };

  it("updates scoped by id AND session_id", async () => {
    const { chains } = mockSupabase([
      { data: { id: CONV }, error: null },
      { data: { ...CONVERSATION_ROW, status: "archived" }, error: null },
    ]);

    const updated = await handleUpdateConversationStatus(input);

    expect(tables(chains)).toEqual(["conversations", "conversations"]);
    expect(scopedBySession(chains[1])).toBe(true);
    expect(chains[1].calls.update).toEqual([[{ status: "archived" }]]);
    expect(updated.status).toBe("archived");
  });

  it("maps a foreign conversation to 404 and never updates it", async () => {
    const { chains } = mockSupabase([{ data: null, error: null }]);

    await expect(handleUpdateConversationStatus(input)).rejects.toMatchObject({ status: 404 });
    expect(chains).toHaveLength(1);
  });
});

describe("handleDeleteConversation", () => {
  const input: DeleteConversationInput = { session_id: SESSION, id: CONV };

  it("deletes only rows the session owns", async () => {
    const { chains } = mockSupabase([{ data: { id: CONV }, error: null }, { error: null }]);

    await expect(handleDeleteConversation(input)).resolves.toEqual({ success: true });
    expect(scopedBySession(chains[1])).toBe(true);
    expect(chains[1].calls.delete).toEqual([[]]);
  });

  it("maps a foreign conversation to 404 and never deletes", async () => {
    const { chains } = mockSupabase([{ data: null, error: null }]);

    await expect(handleDeleteConversation(input)).rejects.toMatchObject({ status: 404 });
    expect(chains).toHaveLength(1);
    expect(chains[0].calls.delete).toBeUndefined();
  });

  it("rejects a caller that sends no session id at all", async () => {
    const { chains } = mockSupabase([]);
    await expect(
      handleDeleteConversation({ id: CONV } as unknown as DeleteConversationInput),
    ).rejects.toMatchObject({ status: 401 });
    expect(chains).toHaveLength(0);
  });
});

describe("ADR-006 regression guards", () => {
  it("never instantiates the anon/cookie SSR client", async () => {
    mockSupabase([{ data: null, error: null }]);

    await expect(handleGetConversation({ session_id: SESSION, id: CONV })).rejects.toMatchObject({
      status: 404,
    });

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).toHaveBeenCalled();
  });

  it("scopes EVERY conversations query by session_id, whatever the handler", async () => {
    const { chains } = mockSupabase([
      // handleCreateConversation
      { error: null },
      { data: CONVERSATION_ROW, error: null },
      // handleGetConversation
      { data: CONVERSATION_ROW, error: null },
      // handleListConversations
      { data: [CONVERSATION_ROW], error: null, count: 1 },
      { data: [{ conversation_id: CONV, content: "salut" }], error: null },
      // handleAppendMessage
      { data: { id: CONV }, error: null },
      { data: MESSAGE_ROW, error: null },
      // handleListMessages
      { data: { id: CONV }, error: null },
      { data: [MESSAGE_ROW], error: null, count: 1 },
      // handleUpdateConversationStatus
      { data: { id: CONV }, error: null },
      { data: CONVERSATION_ROW, error: null },
      // handleDeleteConversation
      { data: { id: CONV }, error: null },
      { error: null },
    ]);

    await handleCreateConversation({ session_id: SESSION });
    await handleGetConversation({ session_id: SESSION, id: CONV });
    await handleListConversations({ session_id: SESSION, page: 1, limit: 20 });
    await handleAppendMessage({
      session_id: SESSION,
      conversation_id: CONV,
      role: "user",
      content: "salut",
    });
    await handleListMessages({
      session_id: SESSION,
      conversation_id: CONV,
      page: 1,
      limit: 50,
    });
    await handleUpdateConversationStatus({ session_id: SESSION, id: CONV, status: "closed" });
    await handleDeleteConversation({ session_id: SESSION, id: CONV });

    const conversationChains = chains.filter((chain) => chain.table === "conversations");
    // 10 conversations queries across the 7 handlers — every one is scoped.
    expect(conversationChains).toHaveLength(10);
    for (const chain of conversationChains) {
      expect(scopedBySession(chain)).toBe(true);
    }
  });

  it("never accepts another session's id as a substitute for the caller's", async () => {
    const { chains } = mockSupabase([{ data: null, error: null }]);

    await expect(
      handleGetConversation({ session_id: OTHER_SESSION, id: CONV }),
    ).rejects.toMatchObject({ status: 404 });

    expect(scopedBySession(chains[0], OTHER_SESSION)).toBe(true);
    expect(scopedBySession(chains[0], SESSION)).toBe(false);
  });
});
