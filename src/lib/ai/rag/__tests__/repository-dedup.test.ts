import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EMBEDDING_CONFIG } from "../../embeddings/config";
import type { MemorySourceIdentity } from "../../contracts/source-key";
import {
  createKnowledgeRepository,
  type KnowledgeRepository,
  type StoredKnowledgeDocument,
} from "../repository";
import { ingestDocument } from "../ingestion";

type FakeRow = Record<string, unknown>;

interface DbResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

interface Filter {
  column: string;
  value: unknown;
  kind: "eq" | "is";
}

interface FakeBuilder {
  select: (columns?: string, options?: { count?: string }) => FakeBuilder;
  insert: (row: FakeRow) => FakeBuilder;
  upsert: (rows: FakeRow[]) => FakeBuilder;
  update: (patch: FakeRow) => FakeBuilder;
  delete: () => FakeBuilder;
  eq: (column: string, value: unknown) => FakeBuilder;
  is: (column: string, value: unknown) => FakeBuilder;
  limit: (count: number) => FakeBuilder;
  order: (column: string, options?: { ascending?: boolean }) => FakeBuilder;
  range: (from: number, to: number) => FakeBuilder;
  single: () => Promise<DbResponse>;
  then: (
    onfulfilled?: (value: DbResponse) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

function isNull(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * In-memory Supabase double enforcing the PARTIAL unique indexes of
 * migration 021:
 * - `uq_knowledge_documents_source_key`: unique on source_key (NOT NULL rows);
 * - `uq_knowledge_documents_content_hash`: unique on content_hash, scoped to
 *   the legacy rows (source_key IS NULL).
 */
function createFakeDb(seed: FakeRow[] = []) {
  const documents: FakeRow[] = seed.map((row) => ({ ...row }));
  const chunks: FakeRow[] = [];
  const calls = { eq: [] as unknown[][], is: [] as unknown[][] };

  function uniqueError(constraint: string): DbResponse["error"] {
    return {
      code: "23505",
      message: `duplicate key value violates unique constraint "${constraint}"`,
    };
  }

  function insertDocument(row: FakeRow): { row: FakeRow | null; error: DbResponse["error"] } {
    const sourceKey = row["source_key"];
    if (!isNull(sourceKey)) {
      const clash = documents.some((doc) => doc["source_key"] === sourceKey);
      if (clash) {
        return { row: null, error: uniqueError("uq_knowledge_documents_source_key") };
      }
    }
    const contentHash = row["content_hash"];
    if (isNull(sourceKey) && !isNull(contentHash)) {
      const clash = documents.some(
        (doc) => isNull(doc["source_key"]) && doc["content_hash"] === contentHash,
      );
      if (clash) {
        return { row: null, error: uniqueError("uq_knowledge_documents_content_hash") };
      }
    }
    const stored: FakeRow = {
      id: `doc-${documents.length + 1}`,
      created_at: "2026-10-30T00:00:00.000Z",
      updated_at: "2026-10-30T00:00:00.000Z",
      locale: "fr",
      tags: [],
      priority: 0,
      metadata: {},
      ...row,
    };
    documents.push(stored);
    return { row: stored, error: null };
  }

  function from(table: string): FakeBuilder {
    const rows = table === "knowledge_documents" ? documents : chunks;
    const filters: Filter[] = [];
    let pendingInsert: FakeRow | null = null;
    let pendingUpsert: FakeRow[] | null = null;
    let pendingUpdate: FakeRow | null = null;
    let pendingDelete = false;
    let limitCount: number | null = null;
    let single = false;

    const matches = (row: FakeRow): boolean =>
      filters.every((filter) => row[filter.column] === filter.value);

    function execute(): DbResponse {
      if (pendingInsert) {
        const result = insertDocument(pendingInsert);
        if (result.error) return { data: null, error: result.error };
        return { data: single ? result.row : [result.row], error: null };
      }
      if (pendingUpsert) {
        const upserted = pendingUpsert.map((row) => {
          const index = chunks.findIndex(
            (chunk) =>
              chunk["document_id"] === row["document_id"] &&
              chunk["chunk_index"] === row["chunk_index"],
          );
          if (index >= 0) {
            chunks[index] = { ...chunks[index], ...row };
            return chunks[index];
          }
          chunks.push(row);
          return row;
        });
        return { data: upserted, error: null };
      }
      if (pendingUpdate) {
        for (const row of rows) {
          if (matches(row)) Object.assign(row, pendingUpdate);
        }
        return { data: rows.filter(matches), error: null };
      }
      if (pendingDelete) {
        const kept = rows.filter((row) => !matches(row));
        rows.length = 0;
        rows.push(...kept);
        return { data: null, error: null };
      }
      let selected = rows.filter(matches);
      if (limitCount !== null) selected = selected.slice(0, limitCount);
      if (single) {
        const first = selected[0];
        if (!first) {
          return {
            data: null,
            error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows" },
          };
        }
        return { data: first, error: null };
      }
      return { data: selected, error: null };
    }

    const builder: FakeBuilder = {
      select: () => builder,
      insert: (row: FakeRow) => {
        pendingInsert = row;
        return builder;
      },
      upsert: (rowsToUpsert: FakeRow[]) => {
        pendingUpsert = rowsToUpsert;
        return builder;
      },
      update: (patch: FakeRow) => {
        pendingUpdate = patch;
        return builder;
      },
      delete: () => {
        pendingDelete = true;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ column, value, kind: "eq" });
        calls.eq.push([column, value]);
        return builder;
      },
      is: (column: string, value: unknown) => {
        filters.push({ column, value, kind: "is" });
        calls.is.push([column, value]);
        return builder;
      },
      limit: (count: number) => {
        limitCount = count;
        return builder;
      },
      order: () => builder,
      range: () => builder,
      single: () => {
        single = true;
        return Promise.resolve(execute());
      },
      then: (onfulfilled, onrejected) => Promise.resolve(execute()).then(onfulfilled, onrejected),
    };
    return builder;
  }

  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, documents, chunks, calls };
}

const embedTexts = async (texts: string[]): Promise<number[][]> =>
  texts.map(() => new Array(EMBEDDING_CONFIG.dimensions).fill(0.1));

const IDENTITY: MemorySourceIdentity = {
  sourceType: "article",
  slug: "audit-seo",
  locale: "fr",
  version: "3f9a1c2b7d44",
};

const SOURCE_KEY = "article:audit-seo:fr:3f9a1c2b7d44";

function findByKey(
  repository: KnowledgeRepository,
  sourceKey: string,
): Promise<StoredKnowledgeDocument | null> {
  const lookup = repository.findDocumentByKey;
  if (!lookup) {
    throw new Error("KnowledgeRepository.findDocumentByKey is required for business identities");
  }
  return lookup.call(repository, sourceKey);
}

describe("repository dedup — identity split (migration 021)", () => {
  it("business: two documents with the same source_key -> one row, second is already_exists", async () => {
    const db = createFakeDb();
    const repository = createKnowledgeRepository(db.client);
    const input = { title: "Audit SEO", rawContent: "# Audit SEO\n\nUn audit complet." };

    const first = await ingestDocument(input, { repository, embedTexts }, { identity: IDENTITY });

    expect(first.status).toBe("created");
    expect(first.sourceKey).toBe(SOURCE_KEY);
    expect(db.documents).toHaveLength(1);
    expect(db.documents[0]?.["source_key"]).toBe(SOURCE_KEY);
    expect(db.documents[0]?.["source_type"]).toBe("article");
    expect(db.documents[0]?.["locale"]).toBe("fr");
    expect(db.documents[0]?.["version"]).toBe(IDENTITY.version);

    const second = await ingestDocument(input, { repository, embedTexts }, { identity: IDENTITY });

    expect(second.status).toBe("already_exists");
    expect(second.documentId).toBe(first.documentId);
    expect(db.documents).toHaveLength(1);
    expect(db.chunks).toHaveLength(1);
  });

  it("legacy: two documents without source_key and the same hash -> one row", async () => {
    const db = createFakeDb();
    const repository = createKnowledgeRepository(db.client);
    const input = {
      title: "FAQ",
      rawContent: "# FAQ\n\nNos tarifs commencent à 5k.",
      sourceType: "faq" as const,
      locale: "fr",
    };

    const first = await ingestDocument(input, { repository, embedTexts });

    expect(first.status).toBe("created");
    expect(first.sourceKey).toBeNull();
    expect(db.documents[0]?.["source_key"]).toBeNull();

    const second = await ingestDocument(input, { repository, embedTexts });

    expect(second.status).toBe("already_exists");
    expect(db.documents).toHaveLength(1);
    // The legacy lookup is scoped to the rows without a business identity.
    expect(db.calls.is).toContainEqual(["source_key", null]);
  });

  it("legacy hash X + business hash X -> two distinct rows", async () => {
    const db = createFakeDb();
    const repository = createKnowledgeRepository(db.client);
    const content = "# Audit\n\nContenu identique des deux côtés.";

    const legacy = await ingestDocument(
      { title: "Legacy", rawContent: content, sourceType: "manual" as const },
      { repository, embedTexts },
    );
    const business = await ingestDocument(
      { title: "Business", rawContent: content },
      { repository, embedTexts },
      { identity: IDENTITY },
    );

    expect(legacy.status).toBe("created");
    expect(business.status).toBe("created");
    expect(db.documents).toHaveLength(2);
    expect(db.documents[0]?.["source_key"]).toBeNull();
    expect(db.documents[1]?.["source_key"]).toBe(SOURCE_KEY);
    // Same bytes, same hash, two different documents.
    expect(db.documents[0]?.["content_hash"]).toBe(db.documents[1]?.["content_hash"]);
    // The legacy lookup never returns a business row: it resolves the LEGACY one.
    const legacyHit = await repository.findDocumentByHash(
      db.documents[1]?.["content_hash"] as string,
    );
    expect(legacyHit?.id).toBe("doc-1");
    expect(legacyHit?.sourceKey).toBeNull();
  });

  it("business: UNIQUE violation (race) -> re-lookup on source_key -> already_exists", async () => {
    const db = createFakeDb([
      {
        id: "doc-concurrent",
        title: "Concurrent",
        content: "# Audit SEO\n\nUn audit complet.",
        source_key: SOURCE_KEY,
        content_hash: "other-hash",
        source_type: "article",
        source_url: null,
        source_path: null,
        version: IDENTITY.version,
        author: null,
        locale: "fr",
        tags: [],
        priority: 0,
        metadata: {},
        created_at: "2026-10-30T00:00:00.000Z",
        updated_at: "2026-10-30T00:00:00.000Z",
      },
    ]);
    const repository = createKnowledgeRepository(db.client);
    let lookups = 0;
    const racing: KnowledgeRepository = {
      ...repository,
      // The concurrent insert lands between the first lookup and the insert.
      findDocumentByKey: async (sourceKey: string) => {
        lookups += 1;
        if (lookups === 1) return null;
        return findByKey(repository, sourceKey);
      },
    };

    const result = await ingestDocument(
      { title: "Audit SEO", rawContent: "# Audit SEO\n\nUn audit complet." },
      { repository: racing, embedTexts },
      { identity: IDENTITY },
    );

    expect(result.status).toBe("already_exists");
    expect(result.documentId).toBe("doc-concurrent");
    expect(lookups).toBe(2);
    expect(db.documents).toHaveLength(1);
  });
});
