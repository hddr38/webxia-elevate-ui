/**
 * Webi knowledge ingestion CLI (SERVER ONLY — never import in the browser).
 *
 * Reproducible, bounded, observable local ingestion.
 *
 * Usage:
 *   npm run ingest -- --file ./docs/faq.md --title "FAQ WebXIA" --source-type faq --locale fr
 *   npm run ingest -- --dir ./docs --slug webxia --batch-size 8 --max-chunks 500 --report ./report.json
 *   npm run ingest -- --file ./docs/faq.md --title "FAQ" --dry-run --report ./plan.json
 *
 * Requires env (only when NOT dry-run):
 *   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 *   NVIDIA_NIM_API_KEY (+ optional NVIDIA_NIM_BASE_URL, NVIDIA_NIM_EMBEDDING_MODEL).
 * Migrations 012/013/014 must have been applied manually via SQL Editor first.
 */
import "dotenv/config";
import { readFile, readdir, stat } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { createKnowledgeRepository } from "@/lib/ai/rag/repository";
import { NvidiaEmbeddingProvider } from "@/lib/ai/embeddings/nvidia";
import { slugify } from "@/lib/utils";
import {
  ingestDocument,
  type IngestionSourceInput,
  normalizeContent,
} from "@/lib/ai/rag/ingestion";
import { chunkTextIntoPieces } from "@/lib/ai/rag/chunker";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

/** ------------------------------------------------------------------ */
/**                      CLI options schema (Zod)                      */
/** ------------------------------------------------------------------ */

const CliOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  dir: z.string().optional(),
  file: z.string().array().optional(),
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
  sourceType: DocumentSource["type"];
  contentLength: number;
  estimatedChunks: number;
  documentId?: string;
  chunkCount?: number;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface RunReport {
  total: number;
  ingested: number;
  alreadyExists: number;
  failed: number;
  skipped: number;
  totalChunks: number;
  dryRun: boolean;
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
  return CliOptionsSchema.parse(raw);
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

Options:
  --file <path>                   Markdown file to ingest (repeatable)
  --dir <path>                    Directory of .md/.mdx files to ingest
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
}

/**
 * Pure ingestion loop: returns a RunReport without writing anything or
 * calling process.exit. Testable with a fake repository/embedTexts.
 */
export async function runIngestion(options: CliOptions, deps: IngestionDeps): Promise<RunReport> {
  const files = await discoverFiles(options);

  const report: RunReport = {
    total: files.length,
    ingested: 0,
    alreadyExists: 0,
    failed: 0,
    skipped: 0,
    totalChunks: 0,
    dryRun: !!options.dryRun,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    files: [],
  };

  let cumulativeChunks = 0;

  for (const file of files) {
    const start = Date.now();
    let fileReport: FileReport;

    try {
      // Size limit check.
      const st = await stat(file);
      if (options.maxFileBytes !== undefined && st.size > options.maxFileBytes) {
        fileReport = makeFileReport({
          path: file,
          status: "skipped",
          title: path.basename(file),
          slug: options.slug ?? slugify(path.basename(file)),
          locale: options.locale ?? DEFAULT_LOCALE,
          sourceType: options.sourceType ?? DEFAULT_SOURCE_TYPE,
          contentLength: st.size,
          estimatedChunks: 0,
          errorCode: "FILE_TOO_LARGE",
          errorMessage: `File ${st.size} bytes exceeds max-file-bytes ${options.maxFileBytes}`,
        });
        report.files.push(fileReport);
        report.skipped += 1;
        continue;
      }

      let rawContent: string;
      try {
        rawContent = await readFile(file, "utf-8");
      } catch {
        throw new CliError("FILE_UNREADABLE", `Unable to read file: ${file}`);
      }
      if (rawContent.trim().length === 0) {
        throw new CliError("EMPTY_FILE", `File is empty: ${file}`);
      }

      const estimated = estimateChunks(rawContent);
      if (options.maxChunks !== undefined && cumulativeChunks + estimated > options.maxChunks) {
        fileReport = makeFileReport({
          path: file,
          status: "skipped",
          title: path.basename(file),
          slug: options.slug ?? slugify(path.basename(file)),
          locale: options.locale ?? DEFAULT_LOCALE,
          sourceType: options.sourceType ?? DEFAULT_SOURCE_TYPE,
          contentLength: Buffer.byteLength(rawContent, "utf-8"),
          estimatedChunks: estimated,
          errorCode: "MAX_CHUNKS",
          errorMessage: `Would exceed max-chunks ${options.maxChunks} (estimated ${estimated} chunks)`,
        });
        report.files.push(fileReport);
        report.skipped += 1;
        continue;
      }

      if (options.dryRun) {
        fileReport = makeFileReport({
          path: file,
          status: "dry-run",
          title: path.basename(file),
          slug: options.slug ?? slugify(path.basename(file)),
          locale: options.locale ?? DEFAULT_LOCALE,
          sourceType: options.sourceType ?? DEFAULT_SOURCE_TYPE,
          contentLength: Buffer.byteLength(rawContent, "utf-8"),
          estimatedChunks: estimated,
        });
        report.files.push(fileReport);
        cumulativeChunks += estimated;
        continue;
      }

      // Real ingestion (non dry-run).
      if (!deps.repository || !deps.embedTexts) {
        throw new CliError(
          "MISSING_DEPS",
          "Repository and embedTexts are required for non-dry-run ingestion.",
        );
      }
      const input: IngestionSourceInput = {
        title: path.basename(file),
        rawContent,
        sourceType: options.sourceType ?? DEFAULT_SOURCE_TYPE,
        sourceUrl: options.url,
        sourcePath: file,
        version: options.version,
        author: options.author,
        locale: options.locale ?? DEFAULT_LOCALE,
      };

      const result = await ingestDocument(
        input,
        {
          repository: deps.repository,
          embedTexts: deps.embedTexts,
        },
        { batchSize: options.batchSize },
      );

      fileReport = makeFileReport({
        path: file,
        status: result.status === "already_exists" ? "already_exists" : "ingested",
        title: result.title,
        slug: options.slug ?? slugify(result.title),
        locale: input.locale ?? DEFAULT_LOCALE,
        sourceType: input.sourceType ?? DEFAULT_SOURCE_TYPE,
        contentLength: Buffer.byteLength(rawContent, "utf-8"),
        estimatedChunks: estimated,
        documentId: result.documentId,
        chunkCount: result.chunkCount,
      });
      if (result.status === "already_exists") {
        report.alreadyExists += 1;
      } else {
        report.ingested += 1;
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
        path: file,
        status: "failed",
        title: path.basename(file),
        slug: options.slug ?? slugify(path.basename(file)),
        locale: options.locale ?? DEFAULT_LOCALE,
        sourceType: options.sourceType ?? DEFAULT_SOURCE_TYPE,
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
    sourceType: DocumentSource["type"];
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
