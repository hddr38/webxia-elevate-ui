import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EMBEDDING_CONFIG } from "../../embeddings/config";
import { KnowledgeRepositoryError, createKnowledgeRepository } from "../repository";

interface DbResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

/** Same chainable-fake convention as memory-service tests (+ limit + upsert + rpc). */
function createFakeClient(queue: DbResponse[]) {
  const calls: Record<string, unknown[][]> = {};
  const fromTables: string[] = [];
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
    "upsert",
    "single",
  ]) {
    calls[m] = [];
    builder[m] = vi.fn((...args: unknown[]) => {
      (calls[m] as unknown[][]).push(args);
      return builder;
    });
  }
  const rpc = vi.fn(async (fnName: string, fnArgs: Record<string, unknown>) => {
    void fnName;
    void fnArgs;
    return queue.shift() ?? { data: null, error: null };
  });
  const from = vi.fn((table: string) => {
    fromTables.push(table);
    return builder;
  });
  const client = { from, rpc } as unknown as SupabaseClient<Database>;
  return { client, calls, from, fromTables, rpc };
}

const DIMS = EMBEDDING_CONFIG.dimensions;

const DOC_ROW = {
  id: "doc-1",
  title: "FAQ Tarifs",
  content: "Nos tarifs commencent à 5k.",
  content_hash: "abc123",
  source_type: "faq",
  source_url: null,
  source_path: "/faq.md",
  version: null,
  author: "WebXIA",
  locale: "fr",
  tags: ["tarifs"],
  priority: 1,
  metadata: { locale: "fr" },
  created_at: "2026-09-10T10:00:00Z",
  updated_at: "2026-09-10T10:00:00Z",
};

const CHUNK_ROW = {
  id: "chunk-1",
  document_id: "doc-1",
  chunk_index: 0,
  content: "Nos tarifs commencent à 5k.",
  embedding: "[0.1]",
  metadata: { chunk_index: 0 },
  created_at: "2026-09-10T10:00:00Z",
};

const MATCH_ROW = {
  chunk_id: "chunk-9",
  document_id: "doc-9",
  chunk_index: 2,
  chunk_content: "Contenu du chunk.",
  chunk_metadata: { chunk_index: 2 },
  document_title: "Guide",
  document_source_type: "manual",
  document_source_url: "https://example.com/guide",
  document_source_path: null,
  document_locale: "fr",
  document_metadata: { priority: 3 },
  similarity: 0.87,
};

function vec(n: number = DIMS): number[] {
  return new Array(n).fill(0.1);
}

describe("KnowledgeRepository", () => {
  it("createDocument maps rows and persists content_hash", async () => {
    const { client, calls } = createFakeClient([{ data: DOC_ROW, error: null }]);
    const repo = createKnowledgeRepository(client);

    const doc = await repo.createDocument({
      title: "FAQ Tarifs",
      content: "Nos tarifs commencent à 5k.",
      source: { type: "faq", path: "/faq.md" },
      metadata: {
        author: "WebXIA",
        createdAt: 0,
        updatedAt: 0,
        tags: ["tarifs"],
        locale: "fr",
        priority: 1,
      },
      contentHash: "abc123",
    });

    expect(doc).toMatchObject({ id: "doc-1", contentHash: "abc123" });
    expect(doc.source).toMatchObject({ type: "faq", path: "/faq.md" });
    const inserted = (calls.insert as unknown[][])[0][0] as Record<string, unknown>;
    expect(inserted["content_hash"]).toBe("abc123");
  });

  it("getDocument throws NOT_FOUND on PGRST116", async () => {
    const { client } = createFakeClient([
      { data: null, error: { message: "no rows", code: "PGRST116" } },
    ]);
    const repo = createKnowledgeRepository(client);
    await expect(repo.getDocument("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("wraps other DB failures as DB_ERROR without leaking internals", async () => {
    const { client } = createFakeClient([{ data: null, error: { message: "boom" } }]);
    const repo = createKnowledgeRepository(client);
    const error = await repo.getDocument("doc-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KnowledgeRepositoryError);
    expect((error as KnowledgeRepositoryError).code).toBe("DB_ERROR");
    expect((error as Error).message).toContain("getDocument failed");
  });

  it("listDocuments filters server-side with bounded pagination", async () => {
    const { client, calls } = createFakeClient([{ data: [DOC_ROW], error: null, count: 1 }]);
    const repo = createKnowledgeRepository(client);

    const page = await repo.listDocuments({ locale: "fr", sourceType: "faq" }, 500, -5);

    expect(page.total).toBe(1);
    expect(page.data).toHaveLength(1);
    expect(calls.eq as unknown[][]).toContainEqual(["locale", "fr"]);
    expect(calls.eq as unknown[][]).toContainEqual(["source_type", "faq"]);
    // limit clamped to 100, offset floored at 0.
    expect(calls.range as unknown[][]).toEqual([[0, 99]]);
  });

  it("updateDocument maps patches to columns", async () => {
    const { client, calls } = createFakeClient([
      { data: { ...DOC_ROW, title: "Nouveau titre" }, error: null },
    ]);
    const repo = createKnowledgeRepository(client);

    const doc = await repo.updateDocument("doc-1", { title: "Nouveau titre", priority: 5 });

    expect(doc.title).toBe("Nouveau titre");
    const patched = (calls.update as unknown[][])[0][0] as Record<string, unknown>;
    expect(patched).toMatchObject({ title: "Nouveau titre", priority: 5 });
  });

  it("deleteDocument removes chunks then the document", async () => {
    const { client, fromTables } = createFakeClient([]);
    const repo = createKnowledgeRepository(client);

    await repo.deleteDocument("doc-1");

    expect(fromTables).toEqual(["knowledge_chunks", "knowledge_documents"]);
  });

  it("findDocumentByHash returns null when absent (idempotent ingestion)", async () => {
    const { client } = createFakeClient([{ data: [], error: null }]);
    const repo = createKnowledgeRepository(client);
    await expect(repo.findDocumentByHash("nope")).resolves.toBeNull();
  });

  it("createChunks validates dimensions and serializes vectors", async () => {
    const { client, calls } = createFakeClient([{ data: [CHUNK_ROW], error: null }]);
    const repo = createKnowledgeRepository(client);

    const chunks = await repo.createChunks("doc-1", [
      { chunkIndex: 0, content: "chunk", embedding: vec(), metadata: { chunk_index: 0 } },
    ]);

    expect(chunks[0]).toMatchObject({ documentId: "doc-1", chunkIndex: 0 });
    const upserted = (calls.upsert as unknown[][])[0][0] as Array<Record<string, unknown>>;
    expect(typeof upserted[0]?.["embedding"]).toBe("string");
    expect(JSON.parse(upserted[0]?.["embedding"] as string)).toHaveLength(DIMS);
  });

  it("createChunks rejects wrong-dimension vectors (no silent resize)", async () => {
    const { client } = createFakeClient([]);
    const repo = createKnowledgeRepository(client);
    await expect(
      repo.createChunks("doc-1", [
        { chunkIndex: 0, content: "chunk", embedding: vec(1536), metadata: {} },
      ]),
    ).rejects.toMatchObject({ code: "DIMENSION_MISMATCH" });
  });

  it("searchChunks calls the RPC with clamped params and distinct identities", async () => {
    const { client, rpc } = createFakeClient([{ data: [MATCH_ROW], error: null }]);
    const repo = createKnowledgeRepository(client);

    const matches = await repo.searchChunks({
      embedding: vec(),
      topK: 999,
      threshold: 0.7,
      locale: "fr",
      sourceType: "manual",
    });

    expect(rpc).toHaveBeenCalledWith(
      "match_knowledge_chunks",
      expect.objectContaining({
        match_threshold: 0.7,
        match_count: 20,
        filter_locale: "fr",
        filter_source_type: "manual",
      }),
    );
    const firstCall = rpc.mock.calls[0];
    expect(firstCall).toBeDefined();
    const rpcArgs = firstCall?.[1] as Record<string, unknown>;
    expect(JSON.parse(rpcArgs["query_embedding"] as string)).toHaveLength(DIMS);

    expect(matches).toHaveLength(1);
    const match = matches[0];
    expect(match?.chunkId).toBe("chunk-9");
    expect(match?.documentId).toBe("doc-9");
    expect(match?.chunkIndex).toBe(2);
    expect(match?.chunkId).not.toBe(match?.documentId);
    expect(match?.similarity).toBe(0.87);
    expect(match?.source).toMatchObject({
      type: "manual",
      url: "https://example.com/guide",
    });
  });

  it("searchChunks rejects wrong-dimension query vectors", async () => {
    const { client, rpc } = createFakeClient([]);
    const repo = createKnowledgeRepository(client);
    await expect(repo.searchChunks({ embedding: vec(1536) })).rejects.toMatchObject({
      code: "DIMENSION_MISMATCH",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("searchChunks returns [] on empty RPC result", async () => {
    const { client } = createFakeClient([{ data: [], error: null }]);
    const repo = createKnowledgeRepository(client);
    await expect(repo.searchChunks({ embedding: vec() })).resolves.toEqual([]);
  });
});
