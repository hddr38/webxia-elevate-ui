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

describe("leads server functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleListLeads", () => {
    it("throws 401 when user not authenticated", async () => {
      createMockClient([{ data: { user: null }, error: { message: "Unauthorized" } }]);

      await expect(handleListLeads({ page: 1, limit: 20 })).rejects.toMatchObject({
        status: 401,
      });
    });

    it("throws 403 when user is not admin", async () => {
      createMockClient([
        { data: { user: { id: "user-1" } }, error: null }, // auth.getUser
        { data: null, error: null }, // admin_users maybeSingle
      ]);

      await expect(handleListLeads({ page: 1, limit: 20 })).rejects.toMatchObject({
        status: 403,
      });
    });

    it("returns leads list with pagination for admin", async () => {
      const mockLeads = [
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

      createMockClient([
        { data: { user: { id: "admin-1" } }, error: null }, // auth.getUser
        { data: { id: "admin-1" }, error: null }, // admin_users maybeSingle
        { data: mockLeads, error: null, count: 2 }, // leads query
      ]);

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
      createMockClient([
        { data: { user: { id: "admin-1" } }, error: null }, // auth.getUser
        { data: { id: "admin-1" }, error: null }, // admin_users maybeSingle
        { data: [], error: null, count: 50 }, // leads query
      ]);

      const result = await handleListLeads({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(5);
    });

    it("throws on Supabase error", async () => {
      createMockClient([
        { data: { user: { id: "admin-1" } }, error: null }, // auth.getUser
        { data: { id: "admin-1" }, error: null }, // admin_users maybeSingle
        { data: null, error: { message: "Database error" }, count: 0 }, // leads query
      ]);

      await expect(handleListLeads({ page: 1, limit: 20 })).rejects.toThrow("Database error");
    });
  });

  describe("handleDeleteLead", () => {
    it("throws 401 when user not authenticated", async () => {
      createMockClient([{ data: { user: null }, error: { message: "Unauthorized" } }]);

      await expect(handleDeleteLead({ id: "lead-1" })).rejects.toMatchObject({
        status: 401,
      });
    });

    it("throws 403 when user is not admin", async () => {
      createMockClient([
        { data: { user: { id: "user-1" } }, error: null }, // auth.getUser
        { data: null, error: null }, // admin_users maybeSingle
      ]);

      await expect(handleDeleteLead({ id: "lead-1" })).rejects.toMatchObject({
        status: 403,
      });
    });

    it("deletes lead successfully for admin", async () => {
      createMockClient([
        { data: { user: { id: "admin-1" } }, error: null }, // auth.getUser
        { data: { id: "admin-1" }, error: null }, // admin_users maybeSingle
        { error: null }, // delete
      ]);

      const result = await handleDeleteLead({ id: "lead-123" });

      expect(result).toEqual({ success: true });
    });

    it("is idempotent (no error if lead not found)", async () => {
      createMockClient([
        { data: { user: { id: "admin-1" } }, error: null }, // auth.getUser
        { data: { id: "admin-1" }, error: null }, // admin_users maybeSingle
        { error: null }, // delete
      ]);

      const result = await handleDeleteLead({ id: "non-existent-lead" });

      expect(result).toEqual({ success: true });
    });

    it("throws on Supabase error", async () => {
      createMockClient([
        { data: { user: { id: "admin-1" } }, error: null }, // auth.getUser
        { data: { id: "admin-1" }, error: null }, // admin_users maybeSingle
        { error: { message: "Delete failed" } }, // delete
      ]);

      await expect(handleDeleteLead({ id: "lead-1" })).rejects.toThrow("Delete failed");
    });
  });
});
