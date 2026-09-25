import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AIMemoryType } from "@/types/database";

export type DbClient = SupabaseClient<Database>;
export type MemoryRow = Database["public"]["Tables"]["ai_memory"]["Row"];
export type MemoryType = AIMemoryType;

/** Agent-facing memory record. `content` lives in the row's `value.content`. */
export interface MemoryEntry {
  id: string;
  sessionId: string;
  userId?: string;
  memoryType: MemoryType;
  key: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryMatch extends MemoryEntry {
  /** Cosine similarity when ranked semantically, otherwise 1 (filter match). */
  score: number;
}

export interface CreateMemoryEntry {
  sessionId: string;
  userId?: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface MemorySearchFilters {
  sessionId?: string;
  memoryType?: MemoryType;
  search?: string;
}

export interface MemorySearchOptions {
  topK?: number;
  threshold?: number;
  filters?: MemorySearchFilters;
}

export type MemoryUpdates = Partial<
  Pick<MemoryEntry, "content" | "embedding" | "metadata" | "memoryType" | "key" | "expiresAt">
>;

export interface MemoryServiceDeps {
  /** Text→vector embedder. Absent → keyword/filter listing, embeddings stored as given. */
  embedText?: (text: string) => Promise<number[]>;
}

export interface MemoryService {
  searchMemory(query: string, options?: MemorySearchOptions): Promise<MemoryMatch[]>;
  createMemory(entry: CreateMemoryEntry): Promise<MemoryEntry>;
  updateMemory(sessionId: string, id: string, updates: MemoryUpdates): Promise<MemoryEntry>;
  deleteMemory(sessionId: string, id: string): Promise<void>;
}

export class MemoryNotFoundError extends Error {
  readonly memoryId: string;
  constructor(memoryId: string) {
    // Same rule as conversations: foreign rows look missing, never forbidden.
    super("Memory not found");
    this.name = "MemoryNotFoundError";
    this.memoryId = memoryId;
  }
}

const CANDIDATE_LIMIT = 100;

function parseEmbedding(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function toEntry(row: MemoryRow): MemoryEntry {
  const value = row.value as unknown;
  const content =
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    typeof (value as { content: unknown }).content === "string"
      ? ((value as { content: string }).content as string)
      : JSON.stringify(value ?? null);
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    memoryType: row.memory_type,
    key: row.key,
    content,
    embedding: parseEmbedding(row.embedding),
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function createMemoryService(
  client: DbClient,
  deps: MemoryServiceDeps = {},
): MemoryService & {
  listMemoryRows: (
    filters: MemorySearchFilters,
    page: number,
    limit: number,
  ) => Promise<{
    data: MemoryRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  getMemoryRow: (id: string) => Promise<MemoryRow>;
  createMemoryRow: (input: {
    sessionId: string;
    userId: string;
    memoryType: MemoryType;
    key: string;
    value: Record<string, string>;
    embedding?: number[] | null;
    metadata?: Record<string, string>;
    expiresAt?: string | null;
  }) => Promise<MemoryRow>;
  updateMemoryRow: (
    id: string,
    userId: string,
    patch: {
      key?: string;
      value?: Record<string, string>;
      metadata?: Record<string, string>;
      expiresAt?: string | null;
    },
  ) => Promise<MemoryRow>;
  deleteMemoryRow: (id: string, userId: string) => Promise<void>;
  deleteSessionMemoryRows: (sessionId: string, userId: string) => Promise<void>;
  getMemoryStats: () => Promise<{
    total: number;
    sessions: number;
    byType: Array<{ memory_type: string; count: number }>;
  }>;
} {
  function applyFilters<T>(
    query: T,
    filters: MemorySearchFilters,
    eq: (q: T, column: string, value: string) => T,
    ilike: (q: T, column: string, pattern: string) => T,
  ): T {
    let q = query;
    if (filters.sessionId) q = eq(q, "session_id", filters.sessionId);
    if (filters.memoryType) q = eq(q, "memory_type", filters.memoryType);
    if (filters.search) q = ilike(q, "key", `%${filters.search}%`);
    return q;
  }

  return {
    async searchMemory(query: string, options: MemorySearchOptions = {}): Promise<MemoryMatch[]> {
      const topK = options.topK ?? 10;
      const threshold = options.threshold ?? 0;
      const filters = options.filters ?? {};

      let builder = client.from("ai_memory").select("*").order("created_at", { ascending: false });
      builder = applyFilters(
        builder,
        filters,
        (q, column, value) => q.eq(column, value),
        (q, column, pattern) => q.ilike(column, pattern),
      );
      const { data, error } = await builder.limit(CANDIDATE_LIMIT);
      if (error) throw new Error(error.message ?? "Database error");
      const rows = (data ?? []) as MemoryRow[];

      // Semantic re-rank when an embedder is available and candidates carry vectors.
      let queryEmbedding: number[] | undefined;
      if (deps.embedText && rows.some((r) => r.embedding)) {
        try {
          queryEmbedding = await deps.embedText(query);
        } catch {
          queryEmbedding = undefined;
        }
      }

      return rows
        .map((row) => {
          const entry = toEntry(row);
          const stored = entry.embedding;
          const score = queryEmbedding && stored ? cosineSimilarity(queryEmbedding, stored) : 1;
          return { ...entry, score };
        })
        .filter((m) => m.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, topK));
    },

    async createMemory(entry: CreateMemoryEntry): Promise<MemoryEntry> {
      if (!entry.userId) {
        // ai_memory.user_id is NOT NULL and no anonymous owner exists.
        // Agent callers must supply the authenticated id (Prompt 5 decision);
        // failing loudly beats silently mis-attributing memories.
        throw new Error("createMemory requires entry.userId (ai_memory.user_id is NOT NULL)");
      }
      const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
      const memoryType = (metadata.memoryType as MemoryType | undefined) ?? "conversation";
      const key =
        typeof metadata.key === "string" && metadata.key.length > 0
          ? metadata.key
          : crypto.randomUUID();
      let embedding = entry.embedding;
      if (!embedding && deps.embedText && entry.content) {
        embedding = await deps.embedText(entry.content);
      }
      const row = await this.createMemoryRow({
        sessionId: entry.sessionId,
        userId: entry.userId,
        memoryType,
        key,
        value: { content: entry.content },
        embedding: embedding ?? null,
        metadata: entry.metadata as Record<string, string> | undefined,
        expiresAt: undefined,
      });
      return toEntry(row);
    },

    async updateMemory(
      sessionId: string,
      id: string,
      updates: MemoryUpdates,
    ): Promise<MemoryEntry> {
      const patch: Database["public"]["Tables"]["ai_memory"]["Update"] = {};
      if (updates.key !== undefined) patch.key = updates.key;
      if (updates.metadata !== undefined) {
        patch.metadata =
          updates.metadata as Database["public"]["Tables"]["ai_memory"]["Update"]["metadata"];
      }
      if (updates.expiresAt !== undefined) patch.expires_at = updates.expiresAt;
      if (updates.memoryType !== undefined) patch.memory_type = updates.memoryType;
      if (updates.content !== undefined) patch.value = { content: updates.content };
      if (updates.embedding !== undefined) {
        patch.embedding = updates.embedding ? JSON.stringify(updates.embedding) : null;
      } else if (updates.content !== undefined && deps.embedText) {
        patch.embedding = JSON.stringify(await deps.embedText(updates.content));
      }

      const { data, error } = await client
        .from("ai_memory")
        .update(patch)
        .eq("id", id)
        .eq("session_id", sessionId)
        .select();

      if (error) throw new Error(error.message ?? "Database error");
      const row = (data ?? [])[0] as MemoryRow | undefined;
      if (!row) throw new MemoryNotFoundError(id);
      return toEntry(row);
    },

    async deleteMemory(sessionId: string, id: string): Promise<void> {
      // Idempotent by design: deleting another session's (or missing) row
      // succeeds silently so existence is never revealed.
      const { error } = await client
        .from("ai_memory")
        .delete()
        .eq("id", id)
        .eq("session_id", sessionId);
      if (error) throw new Error(error.message ?? "Database error");
    },

    // ---- Admin row API (thin, DB-shaped — backs the ai-memory Server Functions)
    async listMemoryRows(filters, page, limit) {
      const safePage = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const offset = (safePage - 1) * safeLimit;
      let builder = client
        .from("ai_memory")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      builder = applyFilters(
        builder,
        filters,
        (q, column, value) => q.eq(column, value),
        (q, column, pattern) => q.ilike(column, pattern),
      );
      const { data, error, count } = await builder.range(offset, offset + safeLimit - 1);
      if (error) throw new Error(error.message ?? "Database error");
      const total = count ?? 0;
      return {
        data: (data ?? []) as MemoryRow[],
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    },

    async getMemoryRow(id: string) {
      const { data, error } = await client.from("ai_memory").select("*").eq("id", id).single();
      if (error || !data) throw new Error(error?.message ?? "Database error");
      return data as MemoryRow;
    },

    async createMemoryRow(input) {
      const { data, error } = await client
        .from("ai_memory")
        .insert({
          session_id: input.sessionId,
          user_id: input.userId,
          memory_type: input.memoryType,
          key: input.key,
          value: input.value as MemoryRow["value"],
          embedding: input.embedding ? JSON.stringify(input.embedding) : null,
          metadata: (input.metadata ?? {}) as MemoryRow["metadata"],
          expires_at: input.expiresAt ?? null,
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Database error");
      return data as MemoryRow;
    },

    async updateMemoryRow(id, userId, patch) {
      const dbPatch: Database["public"]["Tables"]["ai_memory"]["Update"] = {};
      if (patch.key !== undefined) dbPatch.key = patch.key;
      if (patch.value !== undefined) dbPatch.value = patch.value;
      if (patch.metadata !== undefined) dbPatch.metadata = patch.metadata;
      if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt;
      const { data, error } = await client
        .from("ai_memory")
        .update(dbPatch)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Database error");
      return data as MemoryRow;
    },

    async deleteMemoryRow(id, userId) {
      const { error } = await client.from("ai_memory").delete().eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message ?? "Database error");
    },

    async deleteSessionMemoryRows(sessionId, userId) {
      const { error } = await client
        .from("ai_memory")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message ?? "Database error");
    },

    async getMemoryStats() {
      const { data, error } = await client.rpc("get_memory_stats");
      if (error) throw new Error(error.message ?? "Database error");
      // Concrete shape (matches the SQL function): Server Functions require
      // serializable returns, so no unknown/Json leakage here.
      const stats = (data ?? null) as {
        total: number;
        sessions: number;
        byType: Array<{ memory_type: string; count: number }>;
      } | null;
      return (
        stats ?? {
          total: 0,
          sessions: 0,
          byType: [] as Array<{ memory_type: string; count: number }>,
        }
      );
    },
  };
}

/**
 * No module-level default instance on purpose: instantiating one here would
 * call getSupabaseAdmin() at import time and crash every environment without
 * server credentials (tests, client bundles). Callers choose their client
 * explicitly — service-role on the server, anon where RLS must apply.
 */
