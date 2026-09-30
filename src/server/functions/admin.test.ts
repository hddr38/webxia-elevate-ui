import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { handleGetAdminStats } from "./admin";

beforeEach(() => {
  vi.clearAllMocks();
});

const createMockAdmin = (
  rpcResults: Record<string, { data: unknown; error: { code?: string; message: string } | null }>,
  selectResults: Record<
    string,
    { data: unknown; error: { message: string } | null; count: number | null }
  >,
) => {
  const mockRpc = vi.fn((name: string) => {
    const result = rpcResults[name] ?? {
      data: null,
      error: { message: `RPC not mocked: ${name}`, code: "MOCK" },
    };
    return Promise.resolve(result);
  });

  // Create chainable select mocks for each table
  const mockFrom = vi.fn((table: string) => {
    const result = selectResults[table] ?? {
      data: null,
      error: { message: `select not mocked: ${table}` },
      count: null,
    };
    return {
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: (
          resolve: (v: {
            data: unknown;
            error: { message: string } | null;
            count: number | null;
          }) => void,
        ) => {
          resolve(result);
          return Promise.resolve(result);
        },
      })),
      eq: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
  });

  return { rpc: mockRpc, from: mockFrom } as unknown as ReturnType<typeof getSupabaseAdmin>;
};

describe("handleGetAdminStats", () => {
  it("Test 1: RPC articles échoue (non-PGRST202) → throw avec message RPC", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createMockAdmin(
        {
          get_articles_stats: { data: null, error: { code: "500", message: "internal error" } },
          get_realisations_stats: {
            data: { total: 0, published: 0, drafts: 0, featured: 0 },
            error: null,
          },
          get_memory_stats: { data: { total: 0, sessions: 0 }, error: null },
        },
        { articles: { data: null, error: null, count: 0 } },
      ),
    );

    await expect(handleGetAdminStats()).rejects.toThrow(
      "get_articles_stats RPC failed: internal error",
    );
  });

  it("Test 2: RPC realisations échoue (non-PGRST202) → throw", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createMockAdmin(
        {
          get_articles_stats: { data: { total: 0, published: 0, drafts: 0 }, error: null },
          get_realisations_stats: { data: null, error: { code: "401", message: "unauthorized" } },
          get_memory_stats: { data: { total: 0, sessions: 0 }, error: null },
        },
        { realisations: { data: null, error: null, count: 0 } },
      ),
    );

    await expect(handleGetAdminStats()).rejects.toThrow(
      "get_realisations_stats RPC failed: unauthorized",
    );
  });

  it("Test 3: RPC memory échoue (non-PGRST202) → throw", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createMockAdmin(
        {
          get_articles_stats: { data: { total: 0, published: 0, drafts: 0 }, error: null },
          get_realisations_stats: {
            data: { total: 0, published: 0, drafts: 0, featured: 0 },
            error: null,
          },
          get_memory_stats: { data: null, error: { code: "500", message: "db error" } },
        },
        { ai_memory: { data: null, error: null, count: 0 } },
      ),
    );

    await expect(handleGetAdminStats()).rejects.toThrow("get_memory_stats RPC failed: db error");
  });

  it("Test 4: tous les RPC réussissent → {articles, realisations, aiMemory} correct sans throw", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createMockAdmin(
        {
          get_articles_stats: { data: { total: 5, published: 3, drafts: 2 }, error: null },
          get_realisations_stats: {
            data: { total: 4, published: 2, drafts: 2, featured: 1 },
            error: null,
          },
          get_memory_stats: { data: { total: 10, sessions: 3 }, error: null },
        },
        {},
      ),
    );

    const result = await handleGetAdminStats();

    expect(result.articles).toEqual({ total: 5, published: 3, drafts: 2 });
    expect(result.realisations).toEqual({ total: 4, published: 2, drafts: 2, featured: 1 });
    expect(result.aiMemory).toEqual({ total: 10, sessions: 3 });
  });

  it("Test 5: RPC articles error PGRST202 → fallback success", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createMockAdmin(
        {
          get_articles_stats: {
            data: null,
            error: { code: "PGRST202", message: "function not found" },
          },
          get_realisations_stats: {
            data: { total: 0, published: 0, drafts: 0, featured: 0 },
            error: null,
          },
          get_memory_stats: { data: { total: 0, sessions: 0 }, error: null },
        },
        {
          articles: { data: null, error: null, count: 1 },
          realisations: { data: null, error: null, count: 0 },
          ai_memory: { data: null, error: null, count: 0 },
        },
      ),
    );

    const result = await handleGetAdminStats();

    expect(result.articles).toEqual({ total: 1, published: 1, drafts: 1 });
  });
});
