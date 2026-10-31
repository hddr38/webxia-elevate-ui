/**
 * Webi knowledge ingestion CLI (SERVER ONLY — never import in the browser).
 *
 * Reproducible, bounded, observable local ingestion.
 *
 * Usage:
 *   npm run ingest -- --file ./docs/faq.md --title "FAQ WebXIA" --source-type faq --locale fr
 *   npm run ingest -- --dir ./docs --slug webxia --batch-size 8 --max-chunks 500 --report ./report.json
 *   npm run ingest -- --file ./docs/faq.md --title "FAQ" --dry-run --report ./plan.json
 *   npm run ingest -- --source article --dry-run --report ./plan-article.json
 *   npm run ingest -- --source service --dry-run --report ./plan-services.json
 *
 * Source mode (INGEST-3c): `--source article|realisation|service` reads the
 * CMS rows through the pure extractors and joins the SAME processing loop as
 * the markdown pipeline. Mutually exclusive with --file/--dir.
 *
 * Requires env (only when NOT dry-run):
 *   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 *   NVIDIA_NIM_API_KEY (+ optional NVIDIA_NIM_BASE_URL, NVIDIA_NIM_EMBEDDING_MODEL).
 * For --source article|realisation (even in --dry-run, read-only):
 *   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Migrations 012/013/014 must have been applied manually via SQL Editor first.
 */
import "dotenv/config";
import { readFile, readdir, stat } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { createKnowledgeRepository, type KnowledgeDocType } from "@/lib/ai/rag/repository";
import { NvidiaEmbeddingProvider } from "@/lib/ai/embeddings/nvidia";
import { slugify } from "@/lib/utils";
import {
  ingestDocument,
  type IngestionSourceInput,
  normalizeContent,
} from "@/lib/ai/rag/ingestion";
import { chunkTextIntoPieces } from "@/lib/ai/rag/chunker";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  requireCliSourceEnv,
  fetchAllPublishedRows,
  createPublishedPageFetcher,
  CliSourceError,
} from "@/lib/supabase/cli-client";
import {
  extractArticle,
  extractRealisation,
  extractServices,
  type ArticleRow,
  type RealisationRow,
  type ExtractedDocument,
} from "@/lib/ai/rag/extractors";
import { buildSourceKey, type MemorySourceIdentity } from "@/lib/ai/contracts/source-key";
import { servicesFr } from "@/content/services-fr";
import { servicesEn } from "@/content/services-en";
import type { DocumentSource } from "@/lib/ai/contracts";
import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("ingest-knowledge must run on the server (Node.js), never in a browser.");
}

const SOURCE_TYPES: readonly ["website", "manual", "faq", "blog", "case_study"] = [
  "website",
  "manual",
  "faq",
  "blog",
  "case_study",
];

const DEFAULT_LOCALE = "fr";
const DEFAULT_SOURCE_TYPE = "manual";
const BATCH_SIZE_MIN = 1;
const BATCH_SIZE_MAX = 32;

/** Source pipeline kinds (INGEST-3c): CMS-backed extractors. */
export const SOURCE_KINDS = ["article", "realisation", "service"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** ------------------------------------------------------------------ */
/**                      CLI options schema (Zod)                      */
/** ------------------------------------------------------------------ */

const CliOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  dir: z.string().optional(),
  file: z.string().array().optional(),
  source: z.enum(SOURCE_KINDS).optional(),
  slug: z.string().optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  url: z.string().url().optional(),
  locale: z.string().min(1).optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  batchSize: z.coerce.number().int().min(BATCH_SIZE_MIN).max(BATCH_SIZE_MAX).optional(),
  maxChunks: z.coerce.number().int().min(1).optional(),
  maxFileBytes: z.coerce.number().int().min(1).optional(),
  report: z.string().optional(),
  failFast: z.boolean().optional(),
  help: z.boolean().optional(),
});

type CliOptions = z.infer<typeof CliOptionsSchema>;

/** ------------------------------------------------------------------ */
/**                      Typed CLI errors                              */
/** ------------------------------------------------------------------ */

export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;
  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class PathConfinementError extends CliError {
  constructor(kind: "source" | "report", resolved: string, cwd: string) {
    super("PATH_CONFINEMENT", `${kind} path escapes project root: ${resolved}\n  root: ${cwd}`, 2);
  }
}

/** ------------------------------------------------------------------ */
/**                   --source exclusivity (INGEST-3c)                 */
/** ------------------------------------------------------------------ */

/**
 * Options that `--source` owns or renders meaningless. They are rejected
 * with an explicit error — an incompatible option is never ignored
 * silently (the business identity owns the source type, locale, version
 * and slug; the extractors own the URL and the content).
 */
const SOURCE_CONFLICTS: ReadonlyArray<{ readonly key: keyof CliOptions; readonly flag: string }> = [
  { key: "file", flag: "--file" },
  { key: "dir", flag: "--dir" },
  { key: "slug", flag: "--slug" },
  { key: "sourceType", flag: "--source-type" },
  { key: "url", flag: "--url" },
  { key: "locale", flag: "--locale" },
  { key: "version", flag: "--version" },
];

/**
 * `--source` is mutually exclusive with the markdown pipeline (--file/--dir)
 * and with the options the business identity owns. Throws an explicit
 * CliError listing every conflicting flag.
 */
export function assertSourceExclusive(options: CliOptions): void {
  if (!options.source) return;
  const conflicts = SOURCE_CONFLICTS.filter((c) => options[c.key] !== undefined).map((c) => c.flag);
  if (conflicts.length > 0) {
    throw new CliError(
      "SOURCE_EXCLUSIVE",
      `--source (${options.source}) is mutually exclusive with ${conflicts.join(", ")}. ` +
        `Run the markdown pipeline without --source, or --source alone.`,
      2,
    );
  }
}

/** ------------------------------------------------------------------ */
/**                      Path discovery & confinement                  */
/** ------------------------------------------------------------------ */

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

/**
 * Confine a resolved path under `process.cwd()` (source files and report).
 * Rejects anything escaping the project root (e.g. ../../etc/passwd).
 */
export function confinePath(resolved: string, kind: "source" | "report"): string {
  const cwd = process.cwd();
  const cwdResolved = path.resolve(cwd);
  const relative = path.relative(cwdResolved, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathConfinementError(kind, resolved, cwdResolved);
  }
  return resolved;
}

export function resolveCliPath(input: string, kind: "source" | "report"): string {
  return confinePath(path.resolve(input), kind);
}

/**
 * Discover candidate markdown files: single file, repeated --file, or --dir.
 * Returns a deterministically sorted, deduplicated list of absolute paths.
 * Ignores empty or unreadable files (recorded as errors by the caller).
 */
export async function discoverFiles(options: CliOptions): Promise<string[]> {
  const inputs: string[] = [];
  if (options.file) {
    for (const f of options.file) inputs.push(f);
  }
  if (options.dir) {
    inputs.push(options.dir);
  }

  const resolved: string[] = [];
  for (const input of inputs) {
    const r = resolveCliPath(input, "source");
    resolved.push(r);
  }

  const files: string[] = [];
  for (const r of resolved) {
    let st: fs.Stats;
    try {
      st = await stat(r);
    } catch {
      throw new CliError("FILE_NOT_FOUND", `File or directory not found: ${r}`);
    }
    if (st.isDirectory()) {
      const dirFiles = await listMarkdownFiles(r);
      files.push(...dirFiles);
    } else if (st.isFile()) {
      const ext = path.extname(r).toLowerCase();
      if (!MARKDOWN_EXTENSIONS.has(ext)) {
        throw new CliError("INVALID_EXTENSION", `Not a .md/.mdx file: ${r}`);
      }
      files.push(r);
    } else {
      throw new CliError("INVALID_PATH", `Not a regular file or directory: ${r}`);
    }
  }

  // Deterministic sort + dedup.
  const unique = [...new Set(files)].sort((a, b) => a.localeCompare(b));
  return unique;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw new CliError("DIR_NOT_READABLE", `Directory not readable: ${dir}`);
  }
  const files: string[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = await stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      files.push(...(await listMarkdownFiles(full)));
    } else if (st.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (MARKDOWN_EXTENSIONS.has(ext)) {
        files.push(full);
      }
    }
  }
  return files;
}

/** ------------------------------------------------------------------ */
/**                      Report types                                  */
/** ------------------------------------------------------------------ */

export type FileReportStatus =
  "planned" | "dry-run" | "ingested" | "already_exists" | "failed" | "skipped";

export interface FileReport {
  path: string;
  status: FileReportStatus;
  title: string;
  slug: string;
  locale: string;
  /**
   * Legacy types (website|manual|...) for the markdown pipeline, business
   * types (article|realisation|service) for --source (migration 021).
   */
  sourceType: KnowledgeDocType;
  contentLength: number;
  estimatedChunks: number;
  /** Public citation URL (source pipeline; --url in file mode). */
  sourceUrl?: string;
  /** Stable business identity key (migration 021), source pipeline only. */
  sourceKey?: string | null;
  documentId?: string;
  chunkCount?: number;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
}

/** Proof block of what the run actually touched (homogenized JSON report). */
export interface RunSideEffects {
  /** True only if embeddings were really generated (never in dry-run). */
  embeddingsGenerated: boolean;
  /** NVIDIA NIM embedding batch calls (0 in dry-run). */
  nvidiaCalls: number;
  /** Supabase document writes — created/reindexed documents (0 in dry-run). */
  databaseWrites: number;
}

/** Source-mode summary (INGEST-3c): fetched vs extracted vs skipped. */
export interface RunSummary {
  recordsFetched: number;
  documentsExtracted: number;
  estimatedChunks: number;
  documentsSkipped: number;
  errors: number;
}

export interface RunReport {
  total: number;
  ingested: number;
  alreadyExists: number;
  failed: number;
  skipped: number;
  totalChunks: number;
  dryRun: boolean;
  /** "dry-run" = plan only; "ingest" = real writes (never used in INGEST-3c runs). */
  mode: "dry-run" | "ingest";
  /** Present only with --source (absent = markdown INGEST-2 pipeline). */
  source?: SourceKind;
  /** Present only with --source. */
  summary?: RunSummary;
  /** Always present: visual proof of absent side effects in dry-run. */
  sideEffects: RunSideEffects;
  startedAt: string;
  finishedAt: string;
  files: FileReport[];
}

export function estimateChunks(content: string): number {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return 0;
  const pieces = chunkTextIntoPieces(normalized);
  return pieces.length;
}

/** ------------------------------------------------------------------ */
/**                      CLI argument parsing                          */
/** ------------------------------------------------------------------ */

export /** Options CLI qui prennent une valeur (nom kebab-case tel qu'écrit sur la ligne de commande). */
const VALUE_OPTIONS = new Set([
  "file",
  "dir",
  "source",
  "slug",
  "source-type",
  "url",
  "locale",
  "version",
  "author",
  "batch-size",
  "max-chunks",
  "max-file-bytes",
  "report",
]);

/** Convertit un nom kebab-case en camelCase (batch-size → batchSize). */
function kebabToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

export function parseCliArgs(argv: string[]): CliOptions {
  const raw: Record<string, string | string[] | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      raw.help = true;
      i += 1;
      continue;
    }
    if (arg === "--dry-run" || arg === "--fail-fast") {
      raw[kebabToCamel(arg.slice(2))] = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (!VALUE_OPTIONS.has(name)) {
        throw new CliError("UNKNOWN_ARG", `Unknown argument: ${arg}`);
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        const key = kebabToCamel(name);
        if (name === "file") {
          const existing = (raw.file ?? []) as string[];
          raw.file = [...existing, next];
        } else {
          raw[key] = next;
        }
        i += 2;
        continue;
      }
      throw new CliError("MISSING_VALUE", `Missing value for option ${arg}`);
    }
    throw new CliError("UNKNOWN_ARG", `Unknown argument: ${arg}`);
  }
  const options = CliOptionsSchema.parse(raw);
  assertSourceExclusive(options);
  return options;
}

/** ------------------------------------------------------------------ */
/**                      Help                                          */
/** ------------------------------------------------------------------ */

function printHelp(): void {
  const presence = (key: string): string => {
    const value = process.env[key];
    return value && value.length > 0 ? "set" : "MISSING";
  };
  console.log(`Webi knowledge ingestion (server only)

Usage:
  npm run ingest -- --file <path> --title <title> [options]
  npm run ingest -- --dir <path> [options]
  npm run ingest -- --file <path> --dry-run --report ./plan.json
  npm run ingest -- --source article --dry-run --report ./plan-article.json

Options:
  --file <path>                   Markdown file to ingest (repeatable)
  --dir <path>                    Directory of .md/.mdx files to ingest
  --source <kind>                 Ingest from CMS source: article | realisation | service.
                                   Mutually exclusive with --file, --dir, --slug,
                                   --source-type, --url, --locale and --version.
                                   article/realisation read Supabase (published rows only);
                                   service builds the 14 FR/EN service documents.
  --slug <slug>                   Document slug
  --source-type <type>            Source type (website|manual|faq|blog|case_study, default: manual). PDF not supported.
  --url <url>                     Source URL
  --locale <locale>               Document locale (default: fr)
  --version <version>             Document version
  --author <author>               Document author
  --batch-size <number>           Chunks per embedding batch (1-32, default: batchEmbed default 32)
  --max-chunks <number>           Stop before exceeding this many chunks
  --max-file-bytes <number>       Reject files larger than this many bytes
  --report <path>                 Write JSON report to this path
  --dry-run                       Plan only: no DB write, no embedding call
  --fail-fast                     Stop at first file failure
  --help, -h                      (this message)

PDF: --source-type pdf is REMOVED in this batch; no PDF extraction implemented.
Content dedup is based on content_hash: modified content creates a new
document; obsolete versions are not purged here (handled in a later batch).

Environment (.env loaded via dotenv, values never printed):
  NVIDIA_NIM_API_KEY=${presence("NVIDIA_NIM_API_KEY")}
  VITE_SUPABASE_URL=${presence("VITE_SUPABASE_URL")}
  SUPABASE_SERVICE_ROLE_KEY=${presence("SUPABASE_SERVICE_ROLE_KEY")}
  NVIDIA_NIM_BASE_URL=${presence("NVIDIA_NIM_BASE_URL")}
  NVIDIA_NIM_EMBEDDING_MODEL=${presence("NVIDIA_NIM_EMBEDDING_MODEL")}`);
}

/** ------------------------------------------------------------------ */
/**                      Main                                          */
/** ------------------------------------------------------------------ */

interface IngestionDeps {
  dryRun: boolean;
  repository?: ReturnType<typeof createKnowledgeRepository>;
  embedTexts?: (texts: string[]) => Promise<number[][]>;
  /**
   * --source row loaders (INGEST-3c): built from the Supabase admin client
   * in main(), injected as fakes in tests. Strictly read-only.
   */
  fetchArticleRows?: () => Promise<ArticleRow[]>;
  fetchRealisationRows?: () => Promise<RealisationRow[]>;
}

/** ------------------------------------------------------------------ */
/**          Unified pipeline documents (--file and --source)          */
/** ------------------------------------------------------------------ */

/**
 * One document of the SINGLE processing loop: a markdown file (INGEST-2) or
 * an extracted CMS document (INGEST-3c). Both shapes feed the same dry-run
 * / ingest branches — there is no second RAG implementation.
 */
interface PipelineDocument {
  /** Report path: absolute file path, or a stable source ref. */
  ref: string;
  /** Report title: file basename, or the extracted document title. */
  reportTitle: string;
  slug: string;
  locale: string;
  sourceType: KnowledgeDocType;
  /** Public citation URL (extractor), or --url in file mode. */
  sourceUrl?: string;
  /** `sourcePath` forwarded to the ingestion input. */
  sourcePath?: string;
  /** Business identity (source pipeline): owns type, locale and version. */
  identity?: MemorySourceIdentity;
  /** Tags extracted from CMS metadata (articles), forwarded to metadata. */
  tags?: string[];
  /** Absolute markdown file path (file pipeline only). */
  filePath?: string;
  /** Pre-extracted content (source pipeline only). */
  content?: string;
  /** Row rejected by the extractor: reported as skipped, never processed. */
  rejected?: string;
}

interface PipelineBuild {
  entries: PipelineDocument[];
  recordsFetched: number;
  documentsExtracted: number;
}

/** File pipeline document — formulas identical to INGEST-2. */
function makeFileDocument(filePath: string, options: CliOptions): PipelineDocument {
  const basename = path.basename(filePath);
  return {
    ref: filePath,
    reportTitle: basename,
    slug: options.slug ?? slugify(basename),
    locale: options.locale ?? DEFAULT_LOCALE,
    sourceType: options.sourceType ?? DEFAULT_SOURCE_TYPE,
    sourceUrl: options.url,
    sourcePath: filePath,
    filePath,
  };
}

/** Source pipeline document built from an ExtractedDocument (extractors). */
function makeSourceDocument(doc: ExtractedDocument): PipelineDocument {
  const rawTags = doc.metadata["tags"];
  const tags =
    Array.isArray(rawTags) && rawTags.every((tag): tag is string => typeof tag === "string")
      ? rawTags
      : undefined;
  return {
    ref: doc.sourcePath,
    reportTitle: doc.title,
    slug: doc.identity.slug,
    locale: doc.identity.locale,
    sourceType: doc.identity.sourceType,
    sourceUrl: doc.sourceUrl,
    sourcePath: doc.sourcePath,
    identity: doc.identity,
    tags,
    content: doc.content,
  };
}

/** Row the extractor refused (not published / empty slug / too short). */
function makeRejectedDocument(
  source: SourceKind,
  row: ArticleRow | RealisationRow,
  reason: string,
): PipelineDocument {
  const slug = row.slug.length > 0 ? row.slug : "unknown";
  return {
    ref: `source:${source}:${slug}`,
    reportTitle: row.title.length > 0 ? row.title : "(untitled row)",
    slug: row.slug,
    locale: "fr",
    sourceType: source,
    rejected: reason,
  };
}

const EXTRACT_REJECT_REASON =
  "Row rejected by the extractor (status must be published, slug non-empty, content >= 200 chars)";

/** Loads source rows with a typed error; secrets are never echoed. */
async function fetchRowsOrThrow<R>(
  source: "article" | "realisation",
  loader: (() => Promise<R[]>) | undefined,
): Promise<R[]> {
  if (!loader) {
    throw new CliError(
      "MISSING_DEPS",
      `--source ${source} requires a Supabase row loader. ` +
        `Set VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (checked via requireCliSourceEnv).`,
      2,
    );
  }
  try {
    return await loader();
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      "SOURCE_FETCH_FAILED",
      `--source ${source} read failed: ${error instanceof Error ? error.message : "unknown error"}`,
      2,
    );
  }
}

/**
 * Builds the document list for the run:
 * - markdown pipeline: discover + sort files (INGEST-2, unchanged);
 * - source pipeline: fetch published rows (paginated, read-only) or the
 *   static service sections, then run the pure extractors.
 */
async function buildPipeline(options: CliOptions, deps: IngestionDeps): Promise<PipelineBuild> {
  const source = options.source;
  if (!source) {
    const files = await discoverFiles(options);
    const entries = files.map((file) => makeFileDocument(file, options));
    return { entries, recordsFetched: entries.length, documentsExtracted: entries.length };
  }

  if (source === "service") {
    let docs: ExtractedDocument[];
    try {
      docs = await extractServices(servicesFr, servicesEn);
    } catch (error) {
      throw new CliError(
        "SOURCE_EXTRACT_FAILED",
        `--source service extraction failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        2,
      );
    }
    return {
      entries: docs.map((doc) => makeSourceDocument(doc)),
      recordsFetched: docs.length,
      documentsExtracted: docs.length,
    };
  }

  const rows: Array<ArticleRow | RealisationRow> =
    source === "article"
      ? await fetchRowsOrThrow<ArticleRow>("article", deps.fetchArticleRows)
      : await fetchRowsOrThrow<RealisationRow>("realisation", deps.fetchRealisationRows);

  const entries: PipelineDocument[] = [];
  let documentsExtracted = 0;
  for (const row of rows) {
    const extracted =
      source === "article"
        ? await extractArticle(row as ArticleRow)
        : await extractRealisation(row as RealisationRow);
    if (!extracted) {
      entries.push(makeRejectedDocument(source, row, EXTRACT_REJECT_REASON));
      continue;
    }
    entries.push(makeSourceDocument(extracted));
    documentsExtracted += 1;
  }
  return { entries, recordsFetched: rows.length, documentsExtracted };
}

/**
 * Ingestion input for the ONE ingestDocument call site.
 * - Identity mode (--source): the identity owns sourceType/locale/version —
 *   they must NOT appear in the input (INVALID_IDENTITY contract).
 * - Legacy mode (--file): input byte-for-byte identical to INGEST-2.
 */
function buildIngestionInput(
  options: CliOptions,
  entry: PipelineDocument,
  rawContent: string,
): IngestionSourceInput {
  if (entry.identity) {
    return {
      title: entry.reportTitle,
      rawContent,
      sourceUrl: entry.sourceUrl,
      sourcePath: entry.sourcePath,
      tags: entry.tags,
    };
  }
  return {
    title: entry.reportTitle,
    rawContent,
    sourceType: entry.sourceType as DocumentSource["type"],
    sourceUrl: entry.sourceUrl,
    sourcePath: entry.sourcePath,
    version: options.version,
    author: options.author,
    locale: entry.locale,
  };
}

/**
 * Pure ingestion loop: returns a RunReport without calling process.exit.
 * Testable with fake repository/embedTexts/row loaders.
 *
 * Dry-run isolation: the `options.dryRun` branch reports and continues —
 * batchEmbed, NVIDIA NIM, ingestDocument and every Supabase write sit
 * strictly AFTER that branch (or inside main()'s non-dry-run init).
 */
export async function runIngestion(options: CliOptions, deps: IngestionDeps): Promise<RunReport> {
  assertSourceExclusive(options);
  const pipeline = await buildPipeline(options, deps);

  const summary: RunSummary | undefined = options.source
    ? {
        recordsFetched: pipeline.recordsFetched,
        documentsExtracted: pipeline.documentsExtracted,
        estimatedChunks: 0,
        documentsSkipped: 0,
        errors: 0,
      }
    : undefined;

  const report: RunReport = {
    total: pipeline.entries.length,
    ingested: 0,
    alreadyExists: 0,
    failed: 0,
    skipped: 0,
    totalChunks: 0,
    dryRun: !!options.dryRun,
    mode: options.dryRun ? "dry-run" : "ingest",
    ...(options.source ? { source: options.source } : {}),
    ...(summary ? { summary } : {}),
    sideEffects: { embeddingsGenerated: false, nvidiaCalls: 0, databaseWrites: 0 },
    startedAt: new Date().toISOString(),
    finishedAt: "",
    files: [],
  };

  let cumulativeChunks = 0;
  let nvidiaCalls = 0;
  let databaseWrites = 0;

  // Counted wrapper used by the ONE real-ingest call site: proves how many
  // NVIDIA embedding batches ran. Never reachable in dry-run.
  const embedTexts = deps.embedTexts;
  const trackedEmbedTexts = embedTexts
    ? async (texts: string[]): Promise<number[][]> => {
        nvidiaCalls += 1;
        return embedTexts(texts);
      }
    : undefined;

  for (const entry of pipeline.entries) {
    const start = Date.now();
    let fileReport: FileReport;

    try {
      // --- Extractor rejection (source pipeline): reported, never processed.
      if (entry.rejected) {
        report.files.push(
          makeFileReport({
            path: entry.ref,
            status: "skipped",
            title: entry.reportTitle,
            slug: entry.slug,
            locale: entry.locale,
            sourceType: entry.sourceType,
            sourceUrl: entry.sourceUrl,
            contentLength: 0,
            estimatedChunks: 0,
            errorCode: "EXTRACT_REJECTED",
            errorMessage: entry.rejected,
          }),
        );
        report.skipped += 1;
        continue;
      }

      // --- Obtain content: read the markdown file, or use extracted content.
      let rawContent: string;
      let contentBytes: number;

      if (entry.filePath) {
        const st = await stat(entry.filePath);
        if (options.maxFileBytes !== undefined && st.size > options.maxFileBytes) {
          report.files.push(
            makeFileReport({
              path: entry.ref,
              status: "skipped",
              title: entry.reportTitle,
              slug: entry.slug,
              locale: entry.locale,
              sourceType: entry.sourceType,
              sourceUrl: entry.sourceUrl,
              contentLength: st.size,
              estimatedChunks: 0,
              errorCode: "FILE_TOO_LARGE",
              errorMessage: `File ${st.size} bytes exceeds max-file-bytes ${options.maxFileBytes}`,
            }),
          );
          report.skipped += 1;
          continue;
        }
        try {
          rawContent = await readFile(entry.filePath, "utf-8");
        } catch {
          throw new CliError("FILE_UNREADABLE", `Unable to read file: ${entry.filePath}`);
        }
        if (rawContent.trim().length === 0) {
          throw new CliError("EMPTY_FILE", `File is empty: ${entry.filePath}`);
        }
        contentBytes = Buffer.byteLength(rawContent, "utf-8");
      } else {
        rawContent = entry.content ?? "";
        if (rawContent.trim().length === 0) {
          throw new CliError("EMPTY_FILE", `Extracted content is empty: ${entry.ref}`);
        }
        contentBytes = Buffer.byteLength(rawContent, "utf-8");
        if (options.maxFileBytes !== undefined && contentBytes > options.maxFileBytes) {
          report.files.push(
            makeFileReport({
              path: entry.ref,
              status: "skipped",
              title: entry.reportTitle,
              slug: entry.slug,
              locale: entry.locale,
              sourceType: entry.sourceType,
              sourceUrl: entry.sourceUrl,
              contentLength: contentBytes,
              estimatedChunks: 0,
              errorCode: "FILE_TOO_LARGE",
              errorMessage: `Extracted content ${contentBytes} bytes exceeds max-file-bytes ${options.maxFileBytes}`,
            }),
          );
          report.skipped += 1;
          continue;
        }
      }

      const estimated = estimateChunks(rawContent);
      if (summary) summary.estimatedChunks += estimated;
      if (options.maxChunks !== undefined && cumulativeChunks + estimated > options.maxChunks) {
        report.files.push(
          makeFileReport({
            path: entry.ref,
            status: "skipped",
            title: entry.reportTitle,
            slug: entry.slug,
            locale: entry.locale,
            sourceType: entry.sourceType,
            sourceUrl: entry.sourceUrl,
            contentLength: contentBytes,
            estimatedChunks: estimated,
            errorCode: "MAX_CHUNKS",
            errorMessage: `Would exceed max-chunks ${options.maxChunks} (estimated ${estimated} chunks)`,
          }),
        );
        report.skipped += 1;
        continue;
      }

      // --- DRY-RUN: plan only. No batchEmbed, no NVIDIA NIM call, no
      //     ingestDocument and no Supabase write below this branch.
      if (options.dryRun) {
        report.files.push(
          makeFileReport({
            path: entry.ref,
            status: "dry-run",
            title: entry.reportTitle,
            slug: entry.slug,
            locale: entry.locale,
            sourceType: entry.sourceType,
            sourceUrl: entry.sourceUrl,
            sourceKey: entry.identity ? buildSourceKey(entry.identity) : undefined,
            contentLength: contentBytes,
            estimatedChunks: estimated,
          }),
        );
        cumulativeChunks += estimated;
        continue;
      }

      // --- Real ingestion (non dry-run): implemented, executed only OUTSIDE
      //     this batch (INGEST-3c runs stay in --dry-run).
      if (!deps.repository || !embedTexts || !trackedEmbedTexts) {
        throw new CliError(
          "MISSING_DEPS",
          "Repository and embedTexts are required for non-dry-run ingestion.",
        );
      }
      const input = buildIngestionInput(options, entry, rawContent);

      const result = await ingestDocument(
        input,
        {
          repository: deps.repository,
          embedTexts: trackedEmbedTexts,
        },
        { batchSize: options.batchSize, identity: entry.identity },
      );

      fileReport = makeFileReport({
        path: entry.ref,
        status: result.status === "already_exists" ? "already_exists" : "ingested",
        title: result.title,
        slug: entry.identity ? entry.identity.slug : (options.slug ?? slugify(result.title)),
        locale: entry.locale,
        sourceType: entry.sourceType,
        sourceUrl: entry.sourceUrl,
        sourceKey: result.sourceKey,
        contentLength: contentBytes,
        estimatedChunks: estimated,
        documentId: result.documentId,
        chunkCount: result.chunkCount,
      });
      if (result.status === "already_exists") {
        report.alreadyExists += 1;
      } else {
        report.ingested += 1;
        // created | reindexed both perform a real document+chunks write.
        databaseWrites += 1;
      }
      const chunks = result.chunkCount ?? estimated;
      cumulativeChunks += chunks;
      report.totalChunks += chunks;
    } catch (error) {
      const durationMs = Date.now() - start;
      let code = "UNKNOWN_ERROR";
      let message = "Unknown error";
      if (error instanceof CliError) {
        code = error.code;
        message = error.message;
      } else if (error instanceof Error) {
        code = "INGESTION_FAILED";
        message = error.message;
      }
      fileReport = makeFileReport({
        path: entry.ref,
        status: "failed",
        title: entry.reportTitle,
        slug: entry.slug,
        locale: entry.locale,
        sourceType: entry.sourceType,
        sourceUrl: entry.sourceUrl,
        sourceKey: entry.identity ? buildSourceKey(entry.identity) : undefined,
        contentLength: 0,
        estimatedChunks: 0,
        errorCode: code,
        errorMessage: message,
        durationMs,
      });
      report.files.push(fileReport);
      report.failed += 1;
      if (options.failFast) {
        throw error;
      }
      continue;
    }

    report.files.push(fileReport);
    report.files[report.files.length - 1].durationMs = Date.now() - start;
  }

  report.finishedAt = new Date().toISOString();
  report.sideEffects = {
    embeddingsGenerated: nvidiaCalls > 0,
    nvidiaCalls,
    databaseWrites,
  };
  if (report.summary) {
    report.summary.documentsSkipped = report.skipped;
    report.summary.errors = report.failed;
  }
  return report;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const options = parseCliArgs(argv);

  const reportPath = options.report ? resolveCliPath(options.report, "report") : undefined;

  // Embedding provider is only initialized when NOT dry-run (no NIM call in dry-run).
  let deps: IngestionDeps = { dryRun: !!options.dryRun };
  if (!options.dryRun) {
    const embeddingProvider = new NvidiaEmbeddingProvider();
    await embeddingProvider.initialize({
      apiKey: process.env["NVIDIA_NIM_API_KEY"] ?? "",
      baseUrl: process.env["NVIDIA_NIM_BASE_URL"] ?? "https://integrate.api.nvidia.com/v1",
      timeout: 120000,
      maxRetries: 2,
    });
    if (!embeddingProvider.isAvailable()) {
      throw new CliError(
        "EMBEDDING_UNAVAILABLE",
        "Embedding provider unavailable: set NVIDIA_NIM_API_KEY.",
        2,
      );
    }
    deps = {
      dryRun: false,
      repository: createKnowledgeRepository(getSupabaseAdmin()),
      embedTexts: (texts: string[]) => embeddingProvider.batchEmbed(texts),
    };
  }

  // --source article|realisation: read-only paginated fetch. Also active in
  // dry-run (reading is allowed; embedding/NIM/writes are not). Env is
  // validated FIRST with an explicit error that never prints secret values.
  if (options.source === "article" || options.source === "realisation") {
    try {
      requireCliSourceEnv();
    } catch (error) {
      if (error instanceof CliSourceError) {
        throw new CliError(error.code, error.message, 2);
      }
      throw error;
    }
    const client = getSupabaseAdmin();
    if (options.source === "article") {
      deps.fetchArticleRows = () =>
        fetchAllPublishedRows(createPublishedPageFetcher(client, "articles"));
    } else {
      deps.fetchRealisationRows = () =>
        fetchAllPublishedRows(createPublishedPageFetcher(client, "realisations"));
    }
  }

  const report = await runIngestion(options, deps);

  // Write report (even on partial failure).
  if (reportPath) {
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  process.exit(report.failed > 0 ? 1 : 0);
}

export function makeFileReport(
  overrides: Partial<FileReport> & {
    path: string;
    status: FileReportStatus;
    title: string;
    slug: string;
    locale: string;
    sourceType: KnowledgeDocType;
    contentLength: number;
    estimatedChunks: number;
  },
): FileReport {
  return { ...overrides } as FileReport;
}

if (import.meta.main && process.argv[1].includes("ingest-knowledge.ts") && !process.env.VITEST) {
  main().catch((error: unknown) => {
    if (error instanceof CliError) {
      console.error(`${error.code}: ${error.message}`);
      process.exit(error.exitCode);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
