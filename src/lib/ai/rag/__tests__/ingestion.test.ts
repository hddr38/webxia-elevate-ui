import { describe, it, expect, vi } from "vitest";
import { EMBEDDING_CONFIG } from "../../embeddings/config";
import type { KnowledgeRepository } from "../repository";
import { IngestionError, computeContentHash, ingestDocument, normalizeContent } from "../ingestion";

const DIMS = EMBEDDING_CONFIG.dimensions;
const vec = (): number[] => new Array(DIMS).fill(0.2);

function fakeRepository(overrides: Partial<KnowledgeRepository> = {}): KnowledgeRepository {
  return {
    createDocument: vi.fn(async (input) => ({
      id: "doc-new",
      title: input.title,
      content: input.content,
      source: input.source,
      metadata: input.metadata,
      contentHash: input.contentHash ?? null,
      createdAt: "",
      updatedAt: "",
    })),
    getDocument: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    listDocuments: vi.fn(async () => ({ data: [], total: 0 })),
    updateDocument: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    deleteDocument: vi.fn(async () => undefined),
    findDocumentByHash: vi.fn(async () => null),
    createChunks: vi.fn(async () => []),
    deleteChunks: vi.fn(async () => undefined),
    searchChunks: vi.fn(async () => []),
    ...overrides,
  };
}

describe("normalizeContent", () => {
  it("strips front-matter and collapses whitespace", () => {
    const raw = "---\ntitle: FAQ\n---\n\n\n# Hello   \n\n\nBody.\n";
    expect(normalizeContent(raw)).toBe("# Hello\n\nBody.");
  });

  it("normalizes CRLF", () => {
    expect(normalizeContent("a\r\n\r\nb")).toBe("a\n\nb");
  });
});

describe("computeContentHash", () => {
  it("is stable and content-sensitive", async () => {
    const a = await computeContentHash("hello");
    const b = await computeContentHash("hello");
    const c = await computeContentHash("hello!");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ingestDocument", () => {
  const input = {
    title: "FAQ",
    rawContent: "# FAQ\n\nNos tarifs commencent à 5k.",
    sourceType: "faq" as const,
    locale: "fr",
  };

  it("creates a document with chunks and embeddings", async () => {
    const repository = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const result = await ingestDocument(input, { repository, embedTexts });

    expect(result.status).toBe("created");
    expect(result.documentId).toBe("doc-new");
    expect(result.chunkCount).toBe(1);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(embedTexts).toHaveBeenCalledTimes(1);
    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ contentHash: result.contentHash }),
    );
    expect(repository.createChunks).toHaveBeenCalledWith(
      "doc-new",
      expect.arrayContaining([expect.objectContaining({ chunkIndex: 0 })]),
    );
  });

  it("skips re-embedding when the hash already exists", async () => {
    const repository = fakeRepository({
      findDocumentByHash: vi.fn(async () => ({
        id: "doc-old",
        title: "FAQ",
        content: "x",
        source: { type: "faq" as const },
        metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
        contentHash: "h",
        createdAt: "",
        updatedAt: "",
      })),
    });
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const result = await ingestDocument(input, { repository, embedTexts });

    expect(result).toMatchObject({ status: "already_exists", documentId: "doc-old" });
    expect(embedTexts).not.toHaveBeenCalled();
    expect(repository.createDocument).not.toHaveBeenCalled();
  });

  it("forceReindex deletes then recreates", async () => {
    const repository = fakeRepository({
      findDocumentByHash: vi.fn(async () => ({
        id: "doc-old",
        title: "FAQ",
        content: "x",
        source: { type: "faq" as const },
        metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
        contentHash: "h",
        createdAt: "",
        updatedAt: "",
      })),
    });
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const result = await ingestDocument(input, { repository, embedTexts }, { forceReindex: true });

    expect(result.status).toBe("reindexed");
    expect(repository.deleteDocument).toHaveBeenCalledWith("doc-old");
    expect(embedTexts).toHaveBeenCalled();
  });

  it("rejects empty content after normalization", async () => {
    const repository = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    await expect(
      ingestDocument({ ...input, rawContent: "   \n " }, { repository, embedTexts }),
    ).rejects.toMatchObject({ code: "EMPTY_CONTENT" });
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("fails typed on embedding errors (no partial persist)", async () => {
    const repository = fakeRepository();
    const embedTexts = vi.fn(async () => {
      throw new Error("NIM down");
    });

    await expect(ingestDocument(input, { repository, embedTexts })).rejects.toMatchObject({
      code: "EMBEDDING_FAILED",
    });
    expect(repository.createDocument).not.toHaveBeenCalled();
  });

  it("fails typed on wrong-dimension vectors", async () => {
    const repository = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => new Array(1536).fill(0)));

    const error = await ingestDocument(input, { repository, embedTexts }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IngestionError);
    expect((error as IngestionError).code).toBe("EMBEDDING_FAILED");
  });
});
