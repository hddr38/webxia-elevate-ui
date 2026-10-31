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
import {
  fetchAllPublishedRows,
  createPublishedPageFetcher,
  requireCliSourceEnv,
  CliSourceError,
  CLI_PAGE_SIZE,
  type CliPageFetcher,
} from "@/lib/supabase/cli-client";
import { extractRealisation, type ArticleRow, type RealisationRow } from "@/lib/ai/rag/extractors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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

/** ------------------------------------------------------------------ */
/**                 INGEST-3c : --source (extracteurs)                 */
/** ------------------------------------------------------------------ */

const LONG_ARTICLE_MD =
  "# Audit SEO 2026\n\n" +
  "Contenu de l'audit détaillé avec largement plus de deux cents caractères " +
  "pour dépasser le seuil minimal de longueur imposé par l'extracteur et " +
  "garantir que seul un contenu suffisamment riche soit ingéré dans la " +
  "knowledge base RAG du site WebXIA.";

const LONG_ARTICLE_MD_B =
  "# Second article\n\n" +
  "Second contenu éditorial, strictement distinct du premier, dépassant " +
  "lui aussi le seuil minimal de deux cents caractères requis par " +
  "l'extracteur d'articles. Il couvre les bonnes pratiques de vitesse, " +
  "d'accessibilité et de référencement naturel pour les sites d'entreprise.";

const LONG_REALISATION_MD =
  "# Site vitrine Acme\n\n" +
  "Contenu détaillé de la réalisation pour la société Acme : ce site vitrine " +
  "moderne est optimisé pour la conversion et présente les services de " +
  "l'entreprise de manière claire et professionnelle. Il dépasse largement le " +
  "seuil minimal de deux cents caractères imposé par l'extracteur pour " +
  "garantir que seuls les documents suffisamment riches soient ingérés.";

function articleRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: "a-1",
    title: "Audit SEO 2026",
    slug: "audit-seo-2026",
    content_md: LONG_ARTICLE_MD,
    content_html: null,
    excerpt: "Extrait de l'article",
    category: ["seo"],
    tags: ["audit", "seo"],
    cover_image_url: null,
    meta_description: null,
    meta_title: null,
    reading_minutes: 5,
    published_at: "2026-09-01T10:00:00Z",
    author_id: null,
    status: "published",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function realisationRow(overrides: Partial<RealisationRow> = {}): RealisationRow {
  return {
    id: "r-1",
    title: "Site vitrine Acme",
    slug: "site-vitrine-acme",
    description_md: LONG_REALISATION_MD,
    description_html: null,
    short_description: "Site vitrine moderne pour Acme, optimisé conversion.",
    client_name: "Acme Corp",
    technologies: ["React", "Tailwind"],
    category: ["web"],
    featured: true,
    gallery_images: [],
    cover_image_url: null,
    github_url: null,
    project_url: null,
    meta_description: null,
    meta_title: null,
    published_at: "2026-09-01T10:00:00Z",
    author_id: null,
    sort_order: 1,
    status: "published",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

async function expectCliError(run: () => Promise<unknown>, code: string): Promise<cli.CliError> {
  let error: unknown;
  try {
    await run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(cli.CliError);
  expect((error as cli.CliError).code).toBe(code);
  return error as cli.CliError;
}

function expectCliErrorSync(run: () => unknown, code: string): cli.CliError {
  let error: unknown;
  try {
    run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(cli.CliError);
  expect((error as cli.CliError).code).toBe(code);
  return error as cli.CliError;
}

describe("--source exclusivité (INGEST-3c)", () => {
  it("--source est incompatible avec --file (message explicite)", () => {
    const error = expectCliErrorSync(
      () => cli.parseCliArgs(["--source", "article", "--file", "a.md"]),
      "SOURCE_EXCLUSIVE",
    );
    expect(error.message).toContain("--source (article)");
    expect(error.message).toContain("--file");
  });

  it("--source est incompatible avec --dir (message explicite)", () => {
    const error = expectCliErrorSync(
      () => cli.parseCliArgs(["--source", "service", "--dir", "./docs"]),
      "SOURCE_EXCLUSIVE",
    );
    expect(error.message).toContain("--source (service)");
    expect(error.message).toContain("--dir");
  });

  it("--source rejette aussi les options que l'identité possède (aucun silence)", () => {
    const conflicts: Array<[string, string]> = [
      ["--locale", "fr"],
      ["--slug", "webxia"],
      ["--source-type", "faq"],
      ["--url", "https://webxia.fr"],
      ["--version", "1"],
    ];
    for (const [flag, value] of conflicts) {
      const error = expectCliErrorSync(
        () => cli.parseCliArgs(["--source", "realisation", flag, value]),
        "SOURCE_EXCLUSIVE",
      );
      expect(error.message).toContain(flag);
    }
  });

  it("--source seul est valide, --source invalide rejeté", () => {
    expect(cli.parseCliArgs(["--source", "article"]).source).toBe("article");
    expect(cli.parseCliArgs(["--source", "service", "--dry-run"]).source).toBe("service");
    expect(() => cli.parseCliArgs(["--source", "pdf"])).toThrow();
  });

  it("runIngestion applique aussi l'exclusivité (défense en profondeur)", async () => {
    await expectCliError(
      () => cli.runIngestion({ source: "service", file: ["a.md"], dryRun: true }, { dryRun: true }),
      "SOURCE_EXCLUSIVE",
    );
  });
});

describe("fetchAllPublishedRows — pagination robuste (page de 1000)", () => {
  function pagedFetcher(total: number) {
    const rows = Array.from({ length: total }, (_, i) => ({ id: `row-${i}` }));
    const calls: Array<[number, number]> = [];
    const fetchPage: CliPageFetcher<(typeof rows)[number]> = async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    };
    return { fetchPage, calls };
  }

  it("0 résultat → 1 seule requête, tableau vide", async () => {
    const { fetchPage, calls } = pagedFetcher(0);
    const rows = await fetchAllPublishedRows(fetchPage);
    expect(rows).toHaveLength(0);
    expect(calls).toEqual([[0, CLI_PAGE_SIZE - 1]]);
  });

  it("moins de 1000 résultats → 1 seule requête", async () => {
    const { fetchPage, calls } = pagedFetcher(500);
    const rows = await fetchAllPublishedRows(fetchPage);
    expect(rows).toHaveLength(500);
    expect(calls).toEqual([[0, CLI_PAGE_SIZE - 1]]);
  });

  it("exactement 1000 résultats → 2 requêtes (la page courte confirme la fin)", async () => {
    const { fetchPage, calls } = pagedFetcher(1000);
    const rows = await fetchAllPublishedRows(fetchPage);
    expect(rows).toHaveLength(1000);
    expect(calls).toEqual([
      [0, CLI_PAGE_SIZE - 1],
      [CLI_PAGE_SIZE, 2 * CLI_PAGE_SIZE - 1],
    ]);
  });

  it("1001 résultats → 2 requêtes, aucune ligne perdue", async () => {
    const { fetchPage, calls } = pagedFetcher(1001);
    const rows = await fetchAllPublishedRows(fetchPage);
    expect(rows).toHaveLength(1001);
    expect(calls).toHaveLength(2);
    expect(rows[1000].id).toBe("row-1000");
  });

  it("2000 résultats (multiple exact de 1000) → 3 requêtes", async () => {
    const { fetchPage, calls } = pagedFetcher(2000);
    const rows = await fetchAllPublishedRows(fetchPage);
    expect(rows).toHaveLength(2000);
    expect(calls).toEqual([
      [0, CLI_PAGE_SIZE - 1],
      [CLI_PAGE_SIZE, 2 * CLI_PAGE_SIZE - 1],
      [2 * CLI_PAGE_SIZE, 3 * CLI_PAGE_SIZE - 1],
    ]);
  });

  it("erreur PostgREST → CliSourceError DB_QUERY_FAILED", async () => {
    const fetchPage: CliPageFetcher<{ id: string }> = async () => ({
      data: null,
      error: { message: "relation does not exist" },
    });
    let error: unknown;
    try {
      await fetchAllPublishedRows(fetchPage);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliSourceError);
    expect((error as CliSourceError).code).toBe("DB_QUERY_FAILED");
    expect((error as CliSourceError).message).toContain("relation does not exist");
  });

  it("timeout / rejet transport → CliSourceError DB_QUERY_FAILED", async () => {
    const fetchPage: CliPageFetcher<{ id: string }> = async () => {
      throw new Error("operation timeout after 30000ms");
    };
    let error: unknown;
    try {
      await fetchAllPublishedRows(fetchPage);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliSourceError);
    expect((error as CliSourceError).code).toBe("DB_QUERY_FAILED");
    expect((error as CliSourceError).message).toContain("timeout");
  });
});

describe("createPublishedPageFetcher — lecture PostgREST (filtre à la source)", () => {
  type FakeRow = Record<string, unknown>;

  interface FakeBuilder {
    select(columns: string): FakeBuilder;
    eq(column: string, value: string): FakeBuilder;
    order(column: string, options?: { ascending?: boolean }): FakeBuilder;
    range(from: number, to: number): Promise<{ data: FakeRow[]; error: null }>;
  }

  function fakeSupabaseClient(tables: Record<string, FakeRow[]>) {
    const recorded = {
      table: "",
      filters: [] as Array<[string, string]>,
      orders: [] as Array<[string, { ascending?: boolean } | undefined]>,
      ranges: [] as Array<[number, number]>,
    };
    const client = {
      from(table: string): FakeBuilder {
        recorded.table = table;
        const rows = tables[table] ?? [];
        const builder: FakeBuilder = {
          select: () => builder,
          eq: (column, value) => {
            recorded.filters.push([column, value]);
            return builder;
          },
          order: (column, options) => {
            recorded.orders.push([column, options]);
            return builder;
          },
          range: (from, to) => {
            recorded.ranges.push([from, to]);
            const filtered = recorded.filters.reduce(
              (acc, [column, value]) => acc.filter((row) => row[column] === value),
              rows,
            );
            return Promise.resolve({ data: filtered.slice(from, to + 1), error: null });
          },
        };
        return builder;
      },
    };
    return { client: client as unknown as SupabaseClient<Database>, recorded };
  }

  it("filtre status=published, trie par la PK id et pagine avec .range()", async () => {
    const { client, recorded } = fakeSupabaseClient({
      articles: [
        { id: "1", status: "published" },
        { id: "2", status: "draft" },
        { id: "3", status: "published" },
      ],
    });

    const fetcher = createPublishedPageFetcher(client, "articles");
    const rows = await fetchAllPublishedRows(fetcher, { pageSize: 1 });

    // Le brouillon ne quitte jamais la base : filtré À LA SOURCE.
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "published")).toBe(true);
    expect(recorded.table).toBe("articles");
    expect(recorded.filters).toHaveLength(3); // une par requête
    expect(recorded.filters.every(([c, v]) => c === "status" && v === "published")).toBe(true);
    expect(recorded.orders[0]?.[0]).toBe("id");
    expect(recorded.orders[0]?.[1]).toEqual({ ascending: true });
    expect(recorded.ranges).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it("les deux tables sources utilisent la PK id comme colonne de tri", async () => {
    const { client } = fakeSupabaseClient({ realisations: [] });
    const rows = await fetchAllPublishedRows(createPublishedPageFetcher(client, "realisations"));
    expect(rows).toHaveLength(0);
  });
});

describe("erreurs Supabase (env manquante, loader absent, timeout)", () => {
  it("requireCliSourceEnv s'arrête sans jamais afficher les secrets", () => {
    let error: unknown;
    try {
      requireCliSourceEnv({} as NodeJS.ProcessEnv);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliSourceError);
    expect((error as CliSourceError).code).toBe("MISSING_ENV");
    expect((error as CliSourceError).message).toContain("VITE_SUPABASE_URL");
    expect((error as CliSourceError).message).toContain("SUPABASE_SERVICE_ROLE_KEY");

    // Clé partielle : seul le NOM de la variable manquante apparaît.
    let partial: unknown;
    try {
      requireCliSourceEnv({ VITE_SUPABASE_URL: "https://secret-project.supabase.co" });
    } catch (e) {
      partial = e;
    }
    expect((partial as CliSourceError).code).toBe("MISSING_ENV");
    expect((partial as CliSourceError).message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect((partial as CliSourceError).message).not.toContain("secret-project");

    // Environnement complet : valeurs retournées telles quelles.
    const env = requireCliSourceEnv({
      VITE_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(env.url).toBe("https://x.supabase.co");
    expect(env.serviceRoleKey).toBe("service-role-key");
  });

  it("--source article sans loader → MISSING_DEPS explicite", async () => {
    await expectCliError(
      () => cli.runIngestion({ source: "article", dryRun: true }, { dryRun: true }),
      "MISSING_DEPS",
    );
  });

  it("timeout du loader Supabase → SOURCE_FETCH_FAILED (message sans secret)", async () => {
    const fetchArticleRows = vi.fn(async (): Promise<ArticleRow[]> => {
      throw new Error("operation timeout after 30000ms");
    });
    const error = await expectCliError(
      () =>
        cli.runIngestion({ source: "article", dryRun: true }, { dryRun: true, fetchArticleRows }),
      "SOURCE_FETCH_FAILED",
    );
    expect(error.message).toContain("timeout");
  });
});

describe("--source service --dry-run", () => {
  it("produit 14 documents (7 FR + 7 EN) sans aucun effet de bord", async () => {
    const repository = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const report = await cli.runIngestion(
      { source: "service", dryRun: true },
      { dryRun: true, repository, embedTexts },
    );

    expect(report.mode).toBe("dry-run");
    expect(report.source).toBe("service");
    expect(report.dryRun).toBe(true);
    expect(report.total).toBe(14);
    expect(report.summary).toMatchObject({
      recordsFetched: 14,
      documentsExtracted: 14,
      documentsSkipped: 0,
      errors: 0,
    });
    expect(report.summary?.estimatedChunks).toBeGreaterThan(0);
    expect(report.files).toHaveLength(14);
    expect(report.files.every((f) => f.status === "dry-run")).toBe(true);
    expect(report.files.filter((f) => f.locale === "fr")).toHaveLength(7);
    expect(report.files.filter((f) => f.locale === "en")).toHaveLength(7);
    expect(report.files[0].sourceUrl).toBe("https://webxia.fr/services#services");

    // Preuve d'absence d'effets de bord : ni embed, ni NIM, ni écriture.
    expect(report.sideEffects).toEqual({
      embeddingsGenerated: false,
      nvidiaCalls: 0,
      databaseWrites: 0,
    });
    expect(ingestDocument).not.toHaveBeenCalled();
    expect(embedTexts).not.toHaveBeenCalled();
    expect(repository.createDocument).not.toHaveBeenCalled();
    expect(repository.createChunks).not.toHaveBeenCalled();
  });

  it("source_key uniques, au bon format et déterministes", async () => {
    const first = await cli.runIngestion({ source: "service", dryRun: true }, { dryRun: true });
    const keys = first.files.map((f) => f.sourceKey);
    expect(keys.every((k) => typeof k === "string" && k.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(14);
    for (const key of keys) {
      expect(key).toMatch(/^service:section-0[1-7]:(fr|en):[0-9a-f]{12}$/);
    }

    // Une seconde exécution produit exactement les mêmes clés.
    const second = await cli.runIngestion({ source: "service", dryRun: true }, { dryRun: true });
    expect(second.files.map((f) => f.sourceKey)).toEqual(keys);
  });

  it("--max-chunks s'applique aussi au mode source (garde-fou commun)", async () => {
    const report = await cli.runIngestion(
      { source: "service", dryRun: true, maxChunks: 1 },
      { dryRun: true },
    );
    expect(report.skipped).toBe(14);
    expect(report.files.every((f) => f.errorCode === "MAX_CHUNKS")).toBe(true);
    expect(report.summary?.documentsSkipped).toBe(14);
  });
});

describe("--source article --dry-run (Supabase mocké)", () => {
  it("rejette brouillons/contenus courts et génère identités + URLs", async () => {
    const fetchArticleRows = vi.fn(async () => [
      articleRow(),
      articleRow({ id: "a-2", slug: "brouillon", status: "draft" }),
      articleRow({ id: "a-3", slug: "court", content_md: "# Trop court" }),
      articleRow({
        id: "a-4",
        title: "Second article",
        slug: "seconde",
        content_md: LONG_ARTICLE_MD_B,
      }),
    ]);
    const repository = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const report = await cli.runIngestion(
      { source: "article", dryRun: true },
      { dryRun: true, fetchArticleRows, repository, embedTexts },
    );

    expect(report.source).toBe("article");
    expect(report.summary).toMatchObject({
      recordsFetched: 4,
      documentsExtracted: 2,
      documentsSkipped: 2,
      errors: 0,
    });
    expect(fetchArticleRows).toHaveBeenCalledTimes(1);

    const extracted = report.files.filter((f) => f.status === "dry-run");
    const rejected = report.files.filter((f) => f.status === "skipped");
    expect(extracted).toHaveLength(2);
    expect(rejected).toHaveLength(2);
    expect(rejected.every((f) => f.errorCode === "EXTRACT_REJECTED")).toBe(true);

    // Identité métier + URL publique de citation.
    expect(extracted[0].slug).toBe("audit-seo-2026");
    expect(extracted[0].sourceType).toBe("article");
    expect(extracted[0].locale).toBe("fr");
    expect(extracted[0].sourceUrl).toBe("https://webxia.fr/journal/audit-seo-2026");
    expect(extracted[0].path).toBe("articles:audit-seo-2026");
    expect(extracted[0].sourceKey).toMatch(/^article:audit-seo-2026:fr:[0-9a-f]{12}$/);
    expect(extracted[1].slug).toBe("seconde");
    expect(extracted[1].sourceKey).toMatch(/^article:seconde:fr:[0-9a-f]{12}$/);

    // Preuve d'absence d'effets de bord.
    expect(report.sideEffects).toEqual({
      embeddingsGenerated: false,
      nvidiaCalls: 0,
      databaseWrites: 0,
    });
    expect(ingestDocument).not.toHaveBeenCalled();
    expect(embedTexts).not.toHaveBeenCalled();
    expect(repository.createDocument).not.toHaveBeenCalled();
    expect(repository.createChunks).not.toHaveBeenCalled();
  });
});

describe("--source realisation --dry-run (Supabase mocké)", () => {
  it("champs spécifiques (URL /work, sourcePath, source_key) + brouillon rejeté", async () => {
    const fetchRealisationRows = vi.fn(async () => [
      realisationRow(),
      realisationRow({ id: "r-2", slug: "brouillon", status: "draft" }),
    ]);

    const report = await cli.runIngestion(
      { source: "realisation", dryRun: true },
      { dryRun: true, fetchRealisationRows },
    );

    expect(report.source).toBe("realisation");
    expect(report.summary).toMatchObject({
      recordsFetched: 2,
      documentsExtracted: 1,
      documentsSkipped: 1,
      errors: 0,
    });

    const doc = report.files.find((f) => f.status === "dry-run");
    expect(doc).toBeDefined();
    expect(doc!.title).toBe("Site vitrine Acme");
    expect(doc!.slug).toBe("site-vitrine-acme");
    expect(doc!.sourceType).toBe("realisation");
    expect(doc!.locale).toBe("fr");
    expect(doc!.sourceUrl).toBe("https://webxia.fr/work/site-vitrine-acme");
    expect(doc!.path).toBe("realisations:site-vitrine-acme");
    expect(doc!.sourceKey).toMatch(/^realisation:site-vitrine-acme:fr:[0-9a-f]{12}$/);

    // Le rapport transporte exactement le contenu de l'extracteur
    // (titre + chapeau short_description + description_md).
    const expected = await extractRealisation(realisationRow());
    expect(expected).not.toBeNull();
    expect(doc!.contentLength).toBe(Buffer.byteLength(expected!.content, "utf-8"));

    // Aucun effet de bord en dry-run.
    expect(report.sideEffects).toEqual({
      embeddingsGenerated: false,
      nvidiaCalls: 0,
      databaseWrites: 0,
    });
    expect(ingestDocument).not.toHaveBeenCalled();
    expect(report.failed).toBe(0);
  });
});

describe("--source mode réel (ingestDocument mocké, aucune exécution réelle)", () => {
  it("passe l'identité à ingestDocument et omet sourceType/locale/version", async () => {
    const mockedIngestDocument = vi.mocked(ingestDocument);
    mockedIngestDocument.mockResolvedValue({
      status: "created",
      documentId: "doc-1",
      title: "Audit SEO 2026",
      chunkCount: 3,
      contentHash: "abc",
      sourceKey: "article:audit-seo-2026:fr:deadbeef0123",
    });
    const fetchArticleRows = vi.fn(async () => [articleRow()]);
    const repository = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const report = await cli.runIngestion(
      { source: "article" },
      { dryRun: false, repository, embedTexts, fetchArticleRows },
    );

    expect(mockedIngestDocument).toHaveBeenCalledTimes(1);
    const [input, , ingestOptions] = mockedIngestDocument.mock.calls[0];
    expect(ingestOptions?.identity).toMatchObject({
      sourceType: "article",
      slug: "audit-seo-2026",
      locale: "fr",
    });
    // Contrat INVALID_IDENTITY : l'identité possède ces champs.
    expect(input.sourceType).toBeUndefined();
    expect(input.locale).toBeUndefined();
    expect(input.version).toBeUndefined();
    expect(input.sourceUrl).toBe("https://webxia.fr/journal/audit-seo-2026");
    expect(input.sourcePath).toBe("articles:audit-seo-2026");
    expect(input.tags).toEqual(["audit", "seo"]);

    expect(report.mode).toBe("ingest");
    expect(report.ingested).toBe(1);
    expect(report.sideEffects.databaseWrites).toBe(1);
    expect(report.files[0].status).toBe("ingested");
    expect(report.files[0].sourceKey).toBe("article:audit-seo-2026:fr:deadbeef0123");
  });
});

describe("non-régression du mode fichiers (INGEST-2)", () => {
  it("--source absent : schéma et rapport inchangés (sideEffects en plus)", async () => {
    const parsed = cli.parseCliArgs(["--file", "a.md", "--dry-run"]);
    expect(parsed.source).toBeUndefined();

    const dir = await makeTmpDir();
    try {
      await writeFile(path.join(dir, "a.md"), "# Hello\n\nContenu.");
      const report = await cli.runIngestion(
        { file: [path.join(dir, "a.md")], dryRun: true },
        { dryRun: true },
      );
      expect(report.mode).toBe("dry-run");
      expect(report.source).toBeUndefined();
      expect(report.summary).toBeUndefined();
      expect(report.sideEffects).toEqual({
        embeddingsGenerated: false,
        nvidiaCalls: 0,
        databaseWrites: 0,
      });
      expect(report.files).toHaveLength(1);
      expect(report.files[0].status).toBe("dry-run");
      expect(report.files[0].path).toBe(path.join(dir, "a.md"));
    } finally {
      await cleanup(dir);
    }
  });
});
