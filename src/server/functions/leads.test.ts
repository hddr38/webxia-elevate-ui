import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleListLeads, handleDeleteLead } from "./leads";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ adminMiddleware: vi.fn() }));

const CHAIN_METHODS = [
  "select",
  "eq",
  "order",
  "range",
  "delete",
  "insert",
  "single",
  "maybeSingle",
] as const;

function createMockClient(results: unknown[]) {
  const queue = [...results];
  const chains: { table: string; calls: Record<string, unknown[][]> }[] = [];

  const authGetUser = vi.fn().mockImplementation(() => {
    const next =
      queue.length > 0
        ? queue.shift()
        : { data: { user: null }, error: { message: "Unauthorized" } };
    return Promise.resolve(next);
  });

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
    auth: {
      getUser: authGetUser,
    },
  };

  vi.mocked(getSupabaseAdmin).mockReturnValue(
    client as unknown as ReturnType<typeof getSupabaseAdmin>,
  );
  return { chains, queue, authGetUser };
}

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

const MOCK_LEADS = [
  {
    id: "lead-1",
    session_id: "sess-1",
    conversation_id: "conv-1",
    first_name: "Jean",
    email: "jean@example.com",
    phone: null,
    summary: "Wants a quote",
    metadata: {},
    created_at: "2026-10-01T10:00:00Z",
  },
  {
    id: "lead-2",
    session_id: "sess-2",
    conversation_id: null,
    first_name: "Marie",
    email: null,
    phone: "0123456789",
    summary: "Needs SEO audit",
    metadata: {},
    created_at: "2026-10-01T09:00:00Z",
  },
];

describe("leads server functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleListLeads", () => {
    it("handleListLeads does NOT call auth.getUser (uses middleware only)", async () => {
      const authGetUser = vi.fn().mockRejectedValue(new Error("Auth session missing!"));
      vi.mocked(getSupabaseAdmin).mockReturnValue({
        from: (table: string) => {
          const chain: Record<string, unknown> = {};
          for (const method of CHAIN_METHODS) {
            chain[method] = () => chain;
          }
          chain.then = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
            Promise.resolve({ data: MOCK_LEADS.slice(0, 1), error: null, count: 1 }).then(
              resolve,
              reject,
            );
          };
          expect(table).toBe("leads");
          return chain;
        },
        auth: { getUser: authGetUser },
      } as unknown as ReturnType<typeof getSupabaseAdmin>);

      const result = await handleListLeads({ page: 1, limit: 20 });

      expect(authGetUser).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it("handleListLeads does not query admin_users (authorization handled by adminMiddleware)", async () => {
      const { chains } = createMockClient([{ data: [], error: null, count: 0 }]);

      await handleListLeads({ page: 1, limit: 20 });

      expect(chains.map((c) => c.table)).toEqual(["leads"]);
    });

    it("handleListLeads succeeds when auth.getUser would reject", async () => {
      const { authGetUser } = createMockClient([{ data: [], error: null, count: 0 }]);
      authGetUser.mockRejectedValue(new Error("Auth session missing!"));

      const result = await handleListLeads({ page: 1, limit: 20 });

      expect(authGetUser).not.toHaveBeenCalled();
      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    it("returns leads list with pagination for admin", async () => {
      createMockClient([{ data: MOCK_LEADS, error: null, count: 2 }]);

      const result = await handleListLeads({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe("lead-1");
      expect(result.data[1].id).toBe("lead-2");
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("handles pagination correctly", async () => {
      createMockClient([{ data: [], error: null, count: 50 }]);

      const result = await handleListLeads({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(5);
    });

    it("throws on Supabase error", async () => {
      createMockClient([{ data: null, error: { message: "Database error" }, count: 0 }]);

      await expect(handleListLeads({ page: 1, limit: 20 })).rejects.toThrow("Database error");
    });
  });

  describe("handleDeleteLead", () => {
    it("handleDeleteLead does NOT call auth.getUser (uses middleware only)", async () => {
      const authGetUser = vi.fn().mockRejectedValue(new Error("Auth session missing!"));
      vi.mocked(getSupabaseAdmin).mockReturnValue({
        from: (table: string) => {
          const chain: Record<string, unknown> = {};
          for (const method of CHAIN_METHODS) {
            chain[method] = () => chain;
          }
          chain.then = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
            Promise.resolve({ error: null }).then(resolve, reject);
          };
          expect(table).toBe("leads");
          return chain;
        },
        auth: { getUser: authGetUser },
      } as unknown as ReturnType<typeof getSupabaseAdmin>);

      const result = await handleDeleteLead({ id: "lead-123" });

      expect(authGetUser).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("handleDeleteLead does not query admin_users (authorization handled by adminMiddleware)", async () => {
      const { chains } = createMockClient([{ error: null }]);

      const result = await handleDeleteLead({ id: "lead-123" });

      expect(result).toEqual({ success: true });
      expect(chains.map((c) => c.table)).toEqual(["leads"]);
    });

    it("handleDeleteLead succeeds when auth.getUser would reject", async () => {
      const { authGetUser } = createMockClient([{ error: null }]);
      authGetUser.mockRejectedValue(new Error("Auth session missing!"));

      const result = await handleDeleteLead({ id: "lead-123" });

      expect(authGetUser).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("deletes lead successfully for admin", async () => {
      createMockClient([{ error: null }]);

      const result = await handleDeleteLead({ id: "lead-123" });

      expect(result).toEqual({ success: true });
    });

    it("is idempotent (no error if lead not found)", async () => {
      createMockClient([{ error: null }]);

      const result = await handleDeleteLead({ id: "non-existent-lead" });

      expect(result).toEqual({ success: true });
    });

    it("throws on Supabase error", async () => {
      createMockClient([{ error: { message: "Delete failed" } }]);

      await expect(handleDeleteLead({ id: "lead-1" })).rejects.toThrow("Delete failed");
    });
  });
});
