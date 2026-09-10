import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { cosineSimilarity, createMemoryService, MemoryNotFoundError } from "./memory-service";

interface DbResponse {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

/** Minimal chainable fake: every method returns self; awaiting consumes one queued response. */
function createFakeClient(queue: DbResponse[]) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = {
    then: (resolve: (v: DbResponse) => void) =>
      resolve(queue.shift() ?? { data: null, error: null }),
  };
  for (const m of [
    "select",
    "eq",
    "ilike",
    "order",
    "limit",
    "range",
    "insert",
    "update",
    "delete",
    "single",
  ]) {
    calls[m] = [];
    builder[m] = vi.fn((...args: unknown[]) => {
      (calls[m] as unknown[][]).push(args);
      return builder;
    });
  }
  const rpc = vi.fn(async () => queue.shift() ?? { data: null, error: null });
  const from = vi.fn(() => builder);
  const client = { from, rpc } as unknown as SupabaseClient<Database>;
  return { client, calls, from, rpc };
}

const ROW = {
  id: "mem-1",
  session_id: "session-1",
  user_id: "user-1",
  memory_type: "conversation",
  key: "k1",
  value: { content: "hello world" },
  embedding: null,
  metadata: {},
  expires_at: null,
  created_at: "2026-09-09T10:00:00Z",
  updated_at: "2026-09-09T10:00:00Z",
};

describe("memory-service", () => {
  it("searchMemory filters by sessionId server-side", async () => {
    const { client, calls } = createFakeClient([{ data: [ROW], error: null }]);
    const service = createMemoryService(client);

    const matches = await service.searchMemory("hello", { filters: { sessionId: "session-1" } });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: "mem-1", content: "hello world", score: 1 });
    expect(calls.eq as unknown[][]).toContainEqual(["session_id", "session-1"]);
  });

  it("searchMemory re-ranks semantically with threshold + topK", async () => {
    const rows = [
      { ...ROW, id: "a", embedding: JSON.stringify([1, 0]) },
      { ...ROW, id: "b", embedding: JSON.stringify([0, 1]) },
    ];
    const { client } = createFakeClient([{ data: rows, error: null }]);
    const embedText = vi.fn(async () => [1, 0]);
    const service = createMemoryService(client, { embedText });

    const matches = await service.searchMemory("query", { topK: 1, threshold: 0.5 });

    expect(embedText).toHaveBeenCalledWith("query");
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("a");
    expect(matches[0].score).toBeCloseTo(1);
  });

  it("createMemory computes the embedding when absent", async () => {
    const { client } = createFakeClient([
      { data: { ...ROW, embedding: "[0.5,0.5]" }, error: null },
    ]);
    const embedText = vi.fn(async () => [0.5, 0.5]);
    const service = createMemoryService(client, { embedText });

    const entry = await service.createMemory({
      sessionId: "session-1",
      userId: "user-1",
      content: "hello",
    });

    expect(embedText).toHaveBeenCalledWith("hello");
    expect(entry.embedding).toEqual([0.5, 0.5]);
    // The service returns the stored row mapped back (mock echoes ROW).
    expect(entry.content).toBe("hello world");
  });

  it("createMemory stores a null embedding without embedder", async () => {
    const { client } = createFakeClient([{ data: ROW, error: null }]);
    const service = createMemoryService(client);

    const entry = await service.createMemory({
      sessionId: "session-1",
      userId: "user-1",
      content: "hello",
    });

    expect(entry.embedding).toBeUndefined();
  });

  it("createMemory requires userId (NOT NULL column)", async () => {
    const { client } = createFakeClient([]);
    const service = createMemoryService(client);

    await expect(
      service.createMemory({ sessionId: "session-1", content: "hello" }),
    ).rejects.toThrow(/userId/);
  });

  it("updateMemory scopes by session and throws when foreign", async () => {
    const { client, calls } = createFakeClient([{ data: [{ ...ROW, key: "k2" }], error: null }]);
    const service = createMemoryService(client);

    const updated = await service.updateMemory("session-1", "mem-1", { key: "k2" });

    expect(updated.key).toBe("k2");
    const eqCalls = calls.eq as unknown[][];
    expect(eqCalls).toContainEqual(["id", "mem-1"]);
    expect(eqCalls).toContainEqual(["session_id", "session-1"]);

    const { client: client2 } = createFakeClient([{ data: [], error: null }]);
    const service2 = createMemoryService(client2);
    await expect(
      service2.updateMemory("other-session", "mem-1", { key: "k2" }),
    ).rejects.toBeInstanceOf(MemoryNotFoundError);
  });

  it("deleteMemory is idempotent and session-scoped (silent on foreign)", async () => {
    const { client, calls } = createFakeClient([{ data: null, error: null }]);
    const service = createMemoryService(client);

    await expect(service.deleteMemory("other-session", "mem-1")).resolves.toBeUndefined();
    const eqCalls = calls.eq as unknown[][];
    expect(eqCalls).toContainEqual(["id", "mem-1"]);
    expect(eqCalls).toContainEqual(["session_id", "other-session"]);
  });

  it("admin row API preserves shapes (list/get/create/update/delete/stats)", async () => {
    const listRes = { data: [ROW], error: null, count: 1 };
    const { client } = createFakeClient([
      listRes,
      { data: ROW, error: null },
      { data: ROW, error: null },
      { data: ROW, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: { total: 1, sessions: 1, byType: [] }, error: null },
    ]);
    const service = createMemoryService(client);

    const list = await service.listMemoryRows({}, 1, 50);
    expect(list).toMatchObject({ total: 1, page: 1, limit: 50, totalPages: 1 });
    expect(list.data[0]).toMatchObject({ id: "mem-1", session_id: "session-1" });

    const one = await service.getMemoryRow("mem-1");
    expect(one.id).toBe("mem-1");

    const created = await service.createMemoryRow({
      sessionId: "session-1",
      userId: "user-1",
      memoryType: "conversation",
      key: "k1",
      value: { content: "x" },
    });
    expect(created.id).toBe("mem-1");

    const updated = await service.updateMemoryRow("mem-1", "user-1", { key: "k2" });
    expect(updated.id).toBe("mem-1");

    await expect(service.deleteMemoryRow("mem-1", "user-1")).resolves.toBeUndefined();
    await expect(service.deleteSessionMemoryRows("session-1", "user-1")).resolves.toBeUndefined();

    const stats = await service.getMemoryStats();
    expect(stats).toMatchObject({ total: 1, sessions: 1 });
  });

  it("cosineSimilarity behaves on edge cases", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
