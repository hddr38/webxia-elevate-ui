import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Les dépendances @/ du script (hors src/) sont mockées car l'alias @/
// n'est pas résolu depuis le répertoire scripts/ sous vitest.
vi.mock("@/lib/ai/rag/repository", () => ({
  createKnowledgeRepository: vi.fn(),
}));
vi.mock("@/lib/ai/embeddings/nvidia", () => ({
  NvidiaEmbeddingProvider: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/utils", () => ({
  slugify: vi.fn((text: string) =>
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
  ),
}));
vi.mock("@/lib/ai/rag/ingestion", () => ({
  ingestDocument: vi.fn(),
  normalizeContent: vi.fn((raw: string) => String(raw).trim()),
}));
vi.mock("@/lib/ai/rag/chunker", () => ({
  chunkTextIntoPieces: vi.fn((text: string) => {
    const n = Math.max(1, Math.ceil(text.length / 40));
    return Array.from({ length: n }, (_, i) => ({
      content: `chunk-${i}`,
      charStart: i * 40,
      charEnd: (i + 1) * 40,
      tokenEstimate: 10,
    }));
  }),
}));

import * as cli from "../../../../../scripts/ingest-knowledge.ts";

beforeEach(() => {
  vi.mocked(ingestDocument).mockReset();
});

import type { KnowledgeRepository } from "../repository";
import { ingestDocument } from "../ingestion";
import { normalizeContent } from "../ingestion";
import { chunkTextIntoPieces } from "../chunker";

const CWD = process.cwd();
const TMP_PREFIX = path.join(CWD, ".ingest-cli-test-tmp-");

async function makeTmpDir(): Promise<string> {
  const dir = `${TMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

async function writeFile(file: string, content: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, content, "utf-8");
}

async function cleanup(dir: string): Promise<void> {
  await fs.promises.rm(dir, { recursive: true, force: true });
}

afterEach(async () => {
  const entries = await fs.promises.readdir(CWD).catch(() => []);
  await Promise.all(
    entries
      .filter((e) => e.startsWith(".ingest-cli-test-tmp-"))
      .map((e) => fs.promises.rm(path.join(CWD, e), { recursive: true, force: true })),
  );
});

const DIMS = 2048;
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

function existingRepository(): KnowledgeRepository {
  return fakeRepository({
    findDocumentByHash: vi.fn(async () => ({
      id: "doc-old",
      title: "Existing",
      content: "x",
      source: { type: "faq" as const },
      metadata: { createdAt: 0, updatedAt: 0, tags: [], locale: "fr", priority: 0 },
      contentHash: "h",
      createdAt: "",
      updatedAt: "",
    })),
  });
}

describe("parseCliArgs", () => {
  it("parse un fichier unique et les options scalaires", () => {
    const o = cli.parseCliArgs([
      "--file",
      "./docs/faq.md",
      "--slug",
      "webxia",
      "--locale",
      "fr",
      "--version",
      "1",
      "--author",
      "nobody",
      "--batch-size",
      "8",
      "--max-chunks",
      "100",
      "--max-file-bytes",
      "10000",
      "--report",
      "./plan.json",
      "--dry-run",
      "--fail-fast",
    ]);
    expect(o.file).toEqual(["./docs/faq.md"]);
    expect(o.slug).toBe("webxia");
    expect(o.locale).toBe("fr");
    expect(o.batchSize).toBe(8);
    expect(o.maxChunks).toBe(100);
    expect(o.maxFileBytes).toBe(10000);
    expect(o.report).toBe("./plan.json");
    expect(o.dryRun).toBe(true);
    expect(o.failFast).toBe(true);
  });

  it("--file répétable accumule les valeurs", () => {
    const o = cli.parseCliArgs(["--file", "a.md", "--file", "b.md", "--file", "c.md"]);
    expect(o.file).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("défaut source-type non renseigné (manuel géré par l'appelant)", () => {
    expect(cli.parseCliArgs(["--file", "a.md"]).sourceType).toBeUndefined();
  });
});

describe("rejet des options invalides", () => {
  it("batch-size hors plage [1,32]", () => {
    expect(() => cli.parseCliArgs(["--file", "a.md", "--batch-size", "0"])).toThrow();
    expect(() => cli.parseCliArgs(["--file", "a.md", "--batch-size", "33"])).toThrow();
  });

  it("max-chunks doit être >= 1", () => {
    expect(() => cli.parseCliArgs(["--file", "a.md", "--max-chunks", "0"])).toThrow();
  });

  it("--url doit être une URL valide", () => {
    expect(() => cli.parseCliArgs(["--file", "a.md", "--url", "not-a-url"])).toThrow();
  });

  it("argument inconnu", () => {
    let error: unknown;
    try {
      cli.parseCliArgs(["--file", "a.md", "--toto"]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(cli.CliError);
    expect((error as cli.CliError).code).toBe("UNKNOWN_ARG");
  });

  it("valeur manquante pour une option", () => {
    let error: unknown;
    try {
      cli.parseCliArgs(["--file"]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(cli.CliError);
    expect((error as cli.CliError).code).toBe("MISSING_VALUE");
  });

  it("--source-type pdf est rejeté", () => {
    expect(() => cli.parseCliArgs(["--file", "a.md", "--source-type", "pdf"])).toThrow();
    for (const t of ["website", "manual", "faq", "blog", "case_study"]) {
      expect(() => cli.parseCliArgs(["--file", "a.md", "--source-type", t])).not.toThrow();
    }
  });
});

describe("découverte déterministe des fichiers", () => {
  it("trie et déduplique les fichiers d'un répertoire", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "b.md"), "# B");
      await writeFile(path.join(dir, "a.md"), "# A");
      await writeFile(path.join(dir, "c.mdx"), "# C");
      const files = await cli.discoverFiles({ dir });
      expect(files).toEqual([
        path.join(dir, "a.md"),
        path.join(dir, "b.md"),
        path.join(dir, "c.mdx"),
      ]);
    } finally {
      await cleanup(dir);
    }
  });

  it("supporte la répétition de --file", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "z.md"), "# Z");
      await writeFile(path.join(dir, "a.md"), "# A");
      const files = await cli.discoverFiles({
        file: [path.join(dir, "z.md"), path.join(dir, "a.md")],
      });
      expect(files).toEqual([path.join(dir, "a.md"), path.join(dir, "z.md")]);
    } finally {
      await cleanup(dir);
    }
  });

  it("rejette un fichier introuvable", async () => {
    await expect(cli.discoverFiles({ file: [path.join(CWD, "n'existe-pas.md")] })).rejects.toThrow(
      cli.CliError,
    );
  });
});

describe("filtrage .md / .mdx", () => {
  it("ne garde que .md et .mdx", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "a.md"), "# A");
      await writeFile(path.join(dir, "b.mdx"), "# B");
      await writeFile(path.join(dir, "c.txt"), "C");
      await writeFile(path.join(dir, "d.pdf"), "%PDF");
      await writeFile(path.join(dir, "e.md.bak"), "bak");
      const files = await cli.discoverFiles({ dir });
      expect(files.map((f) => path.basename(f))).toEqual(["a.md", "b.mdx"]);
    } finally {
      await cleanup(dir);
    }
  });
});

describe("confinement des chemins (source et rapport)", () => {
  it("rejette une source hors du projet", () => {
    expect(() => cli.confinePath(path.resolve(CWD, "../../etc/passwd"), "source")).toThrow(
      cli.PathConfinementError,
    );
    expect(() => cli.resolveCliPath("../../etc/passwd", "source")).toThrow(
      cli.PathConfinementError,
    );
  });

  it("rejette un rapport hors du projet", () => {
    expect(() => cli.confinePath(path.resolve(CWD, "../../report.json"), "report")).toThrow(
      cli.PathConfinementError,
    );
    expect(() => cli.resolveCliPath("../../report.json", "report")).toThrow(
      cli.PathConfinementError,
    );
  });

  it("accepte un chemin relatif sous le projet", () => {
    const resolved = cli.resolveCliPath("README.md", "source");
    expect(resolved).toBe(path.resolve(CWD, "README.md"));
  });
});

describe("dry-run sans écriture ni appel embeddings", () => {
  it("ne crée pas de document ni n'appelle les embeddings", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "a.md"), "# Hello\n\nContenu de test.");
      const repository = fakeRepository();
      const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

      const report = await cli.runIngestion(
        { file: [path.join(dir, "a.md")], dryRun: true },
        { dryRun: true, repository, embedTexts },
      );

      expect(report.dryRun).toBe(true);
      expect(report.files[0].status).toBe("dry-run");
      expect(report.files[0].estimatedChunks).toBeGreaterThan(0);
      expect(report.ingested).toBe(0);
      expect(report.failed).toBe(0);
      expect(repository.createDocument).not.toHaveBeenCalled();
      expect(repository.createChunks).not.toHaveBeenCalled();
      expect(embedTexts).not.toHaveBeenCalled();
    } finally {
      await cleanup(dir);
    }
  });
});

describe("limites max-file-bytes et max-chunks", () => {
  it("rejette un fichier trop gros (max-file-bytes)", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "big.md"), "x".repeat(200));
      const report = await cli.runIngestion(
        { file: [path.join(dir, "big.md")], maxFileBytes: 50 },
        { dryRun: true },
      );
      expect(report.files[0].status).toBe("skipped");
      expect(report.files[0].errorCode).toBe("FILE_TOO_LARGE");
      expect(report.skipped).toBe(1);
    } finally {
      await cleanup(dir);
    }
  });

  it("arrête avant dépassement (max-chunks)", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "long.md"), "# Long\n\n" + "lorem ipsum ".repeat(250));
      const report = await cli.runIngestion(
        { file: [path.join(dir, "long.md")], maxChunks: 1 },
        { dryRun: true },
      );
      expect(report.files[0].status).toBe("skipped");
      expect(report.files[0].errorCode).toBe("MAX_CHUNKS");
      expect(report.skipped).toBe(1);
    } finally {
      await cleanup(dir);
    }
  });
});

describe("rapport JSON (succès, already_exists, échec)", () => {
  const mockedIngestDocument = vi.mocked(ingestDocument);

  it("succès -> ingested avec documentId et chunkCount", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "a.md"), "# FAQ\n\nNos tarifs commencent à 5k.");
      mockedIngestDocument.mockResolvedValue({
        status: "created",
        documentId: "doc-new",
        title: "a.md",
        chunkCount: 2,
        contentHash: "abc",
      });
      const repository = fakeRepository();
      const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

      const report = await cli.runIngestion(
        { file: [path.join(dir, "a.md")], slug: "faq" },
        { dryRun: false, repository, embedTexts },
      );

      expect(report.files[0].status).toBe("ingested");
      expect(report.files[0].documentId).toBe("doc-new");
      expect(report.files[0].chunkCount).toBe(2);
      expect(report.ingested).toBe(1);
      expect(report.failed).toBe(0);
      expect(report.totalChunks).toBeGreaterThan(0);
      expect(typeof report.startedAt).toBe("string");
      expect(typeof report.finishedAt).toBe("string");
    } finally {
      await cleanup(dir);
    }
  });

  it("déjà existant -> already_exists, pas de nouvel embedding", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "a.md"), "# FAQ\n\nNos tarifs commencent à 5k.");
      mockedIngestDocument.mockResolvedValue({
        status: "already_exists",
        documentId: "doc-old",
        title: "Existing",
        chunkCount: 0,
        contentHash: "h",
      });
      const repository = existingRepository();
      const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

      const report = await cli.runIngestion(
        { file: [path.join(dir, "a.md")] },
        { dryRun: false, repository, embedTexts },
      );

      expect(report.files[0].status).toBe("already_exists");
      expect(report.files[0].documentId).toBe("doc-old");
      expect(report.alreadyExists).toBe(1);
      expect(report.ingested).toBe(0);
      expect(embedTexts).not.toHaveBeenCalled();
    } finally {
      await cleanup(dir);
    }
  });

  it("échec d'un fichier -> failed avec errorCode et errorMessage", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "a.md"), "# FAQ\n\nContenu.");
      mockedIngestDocument.mockRejectedValue(new Error("DB down"));
      const repository = fakeRepository();
      const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

      const report = await cli.runIngestion(
        { file: [path.join(dir, "a.md")] },
        { dryRun: false, repository, embedTexts },
      );

      expect(report.files[0].status).toBe("failed");
      expect(report.files[0].errorCode).toBeDefined();
      expect(report.files[0].errorMessage).toBeDefined();
      expect(report.failed).toBe(1);
      expect(report.ingested).toBe(0);
    } finally {
      await cleanup(dir);
    }
  });
});

describe("continuation après échec / fail-fast", () => {
  const mockedIngestDocument = vi.mocked(ingestDocument);

  it("continue après un échec sans --fail-fast", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "bad.md"), "# Bad");
      await writeFile(path.join(dir, "good.md"), "# Good\n\nContenu valide ici.");
      const repository = fakeRepository();
      const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));
      mockedIngestDocument.mockRejectedValueOnce(new Error("DB down"));
      mockedIngestDocument.mockResolvedValue({
        status: "created",
        documentId: "doc-new",
        title: "good.md",
        chunkCount: 1,
        contentHash: "x",
      });

      const report = await cli.runIngestion(
        { file: [path.join(dir, "bad.md"), path.join(dir, "good.md")] },
        { dryRun: false, repository, embedTexts },
      );

      expect(report.failed).toBe(1);
      expect(report.ingested).toBe(1);
      expect(report.files.length).toBe(2);
      expect(report.files[0].status).toBe("failed");
      expect(report.files[1].status).toBe("ingested");
      expect(mockedIngestDocument).toHaveBeenCalledTimes(2);
    } finally {
      await cleanup(dir);
    }
  });

  it("s'arrête immédiatement avec --fail-fast", async () => {
    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "bad.md"), "# Bad");
      await writeFile(path.join(dir, "good.md"), "# Good");
      const repository = fakeRepository();
      const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));
      mockedIngestDocument.mockRejectedValue(new Error("DB down"));

      await expect(
        cli.runIngestion(
          { file: [path.join(dir, "bad.md"), path.join(dir, "good.md")], failFast: true },
          { dryRun: false, repository, embedTexts },
        ),
      ).rejects.toThrow();
      expect(mockedIngestDocument).toHaveBeenCalledTimes(1);
    } finally {
      await cleanup(dir);
    }
  });
});

describe("estimateChunks", () => {
  beforeEach(() => {
    vi.mocked(normalizeContent).mockImplementation((raw: string) => String(raw).trim());
    vi.mocked(chunkTextIntoPieces).mockImplementation((text: string) => {
      const n = text.length > 10 ? 3 : 1;
      return Array.from({ length: n }, (_, i) => ({
        index: i,
        content: `c${i}`,
        charStart: 0,
        charEnd: 0,
        tokenEstimate: 1,
      }));
    });
  });

  it("retourne 0 pour du vide", () => {
    expect(cli.estimateChunks("")).toBe(0);
    expect(cli.estimateChunks("   \n ")).toBe(0);
  });

  it("est déterministe et contenu-dépendant", () => {
    const a = cli.estimateChunks("# Hello\n\nUn peu de contenu ici.");
    const b = cli.estimateChunks("# Hello\n\nUn peu de contenu ici.");
    const c = cli.estimateChunks("# Autre");
    expect(a).toBe(3);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    expect(a).not.toBe(c);
  });
});
