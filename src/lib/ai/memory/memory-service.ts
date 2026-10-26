import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AIMemoryType, MemoryScope } from "@/types/database";

type DbClient = SupabaseClient<Database>;
type MemoryRow = Database["public"]["Tables"]["ai_memory"]["Row"];
type MemoryType = AIMemoryType;

/** Agent-facing memory record. `content` lives in the row's `value.content`. */
interface MemoryEntry {
  id: string;
  sessionId: string | null;
  userId?: string;
  memoryType: MemoryType;
  key: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  scope: MemoryScope;
}

interface MemoryMatch extends MemoryEntry {
  /** Cosine similarity when ranked semantically, otherwise 1 (filter match). */
  score: number;
}

interface CreateMemoryEntry {
  sessionId: string;
  userId?: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

interface MemorySearchFilters {
  sessionId?: string;
  scope?: MemoryScope;
  memoryType?: MemoryType;
  search?: string;
}

interface MemorySearchOptions {
  topK?: number;
  threshold?: number;
  filters?: MemorySearchFilters;
}

type MemoryUpdates = Partial<
  Pick<MemoryEntry, "content" | "embedding" | "metadata" | "memoryType" | "key" | "expiresAt">
>;

interface MemoryServiceDeps {
  /** Text→vector embedder. Absent → keyword/filter listing, embeddings stored as given. */
  embedText?: (text: string) => Promise<number[]>;
}

interface MemorySearchResult {
  globalMatches: MemoryMatch[];
  sessionMatches: MemoryMatch[];
}

interface MemoryService {
  searchMemory(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult>;
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
    sessionId: row.session_id ?? null,
    userId: row.user_id,
    memoryType: row.memory_type,
    key: row.key,
    content,
    embedding: parseEmbedding(row.embedding),
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scope: (row.scope ?? "session") as MemoryScope,
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

/**
 * Transforme des lignes brutes en MemoryMatch notés, filtrés par seuil,
 * dédupliqués par contenu normalisé et tronqués à `limit`.
 */
function processMatches(
  rows: MemoryRow[],
  queryEmbedding: number[] | undefined,
  threshold: number,
  limit: number,
): MemoryMatch[] {
  const seen = new Set<string>();
  return rows
    .map((row) => {
      const entry = toEntry(row);
      const stored = entry.embedding;
      const score = queryEmbedding && stored ? cosineSimilarity(queryEmbedding, stored) : 1;
      return { ...entry, score };
    })
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .filter((m) => {
      const norm = normalizeContent(m.content);
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    })
    .slice(0, Math.max(1, limit));
}

/** Normalisation pour la déduplication (espace + casse ignorés). */
function normalizeContent(content: string): string {
  return content.trim().toLowerCase();
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
    sessionId: string | null;
    userId: string;
    memoryType: MemoryType;
    scope: MemoryScope;
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
      scope?: MemoryScope;
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
    async searchMemory(
      query: string,
      options: MemorySearchOptions = {},
    ): Promise<{
      globalMatches: MemoryMatch[];
      sessionMatches: MemoryMatch[];
    }> {
      const topK = options.topK ?? 10;
      const threshold = options.threshold ?? 0;
      const filters = options.filters ?? {};

      const now = new Date().toISOString();
      // Exclut les mémoires expirées (expires_at renseigné et dépassé).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notExpired = (q: any) => q.or(`expires_at.is.null,expires_at.gte.${now}`) as any;

      // --- Global : scope='global', pas de filtre session, max 5 candidats ---
      let globalBuilder = client.from("ai_memory").select("*").eq("scope", "global");
      if (filters.memoryType) {
        globalBuilder = globalBuilder.eq("memory_type", filters.memoryType);
      }
      if (filters.search) {
        globalBuilder = globalBuilder.ilike("key", `%${filters.search}%`);
      }
      globalBuilder = notExpired(globalBuilder);
      const { data: globalRows, error: globalError } = await globalBuilder
        .order("created_at", { ascending: false })
        .limit(5);
      if (globalError) throw new Error(globalError.message ?? "Database error");

      // --- Session : scope='session', filtrée par sessionId, comportement actuel ---
      let sessionBuilder = client.from("ai_memory").select("*").eq("scope", "session");
      sessionBuilder = applyFilters(
        sessionBuilder,
        filters,
        (q, column, value) => q.eq(column, value),
        (q, column, pattern) => q.ilike(column, pattern),
      );
      sessionBuilder = notExpired(sessionBuilder);
      const { data: sessionRows, error: sessionError } = await sessionBuilder
        .order("created_at", { ascending: false })
        .limit(CANDIDATE_LIMIT);
      if (sessionError) throw new Error(sessionError.message ?? "Database error");

      // Un seul embedder pour global + session (même EMBEDDING_CONFIG que le RAG).
      const allRows = [...(globalRows ?? []), ...(sessionRows ?? [])];
      let queryEmbedding: number[] | undefined;
      if (deps.embedText && allRows.some((r) => r.embedding)) {
        try {
          queryEmbedding = await deps.embedText(query);
        } catch {
          queryEmbedding = undefined;
        }
      }

      const globalMatches = processMatches(
        (globalRows ?? []) as MemoryRow[],
        queryEmbedding,
        threshold,
        5,
      );
      const sessionMatches = processMatches(
        (sessionRows ?? []) as MemoryRow[],
        queryEmbedding,
        threshold,
        topK,
      );

      return { globalMatches, sessionMatches };
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
        scope: "session",
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
      if (filters.scope) {
        builder = builder.eq("scope", filters.scope);
      }
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
          scope: input.scope,
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
      if (patch.scope !== undefined) dbPatch.scope = patch.scope;
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
