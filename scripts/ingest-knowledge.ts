/**
 * Webi knowledge ingestion CLI (SERVER ONLY — never import in the browser).
 *
 * Usage:
 *   npx tsx scripts/ingest-knowledge.ts --file ./docs/faq.md --title "FAQ WebXIA" \
 *     --source-type faq --locale fr --tags "faq,tarifs" [--force]
 *
 * Requires env: SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 * NVIDIA_NIM_API_KEY (+ optional NVIDIA_NIM_BASE_URL, NVIDIA_NIM_EMBEDDING_MODEL).
 * Migrations 012/013/014 must have been applied manually via SQL Editor first.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createKnowledgeRepository } from "@/lib/ai/rag/repository";
import { NvidiaEmbeddingProvider } from "@/lib/ai/embeddings/nvidia";
import { ingestDocument, type IngestionSourceInput } from "@/lib/ai/rag/ingestion";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DocumentSource } from "@/lib/ai/contracts";

if (typeof window !== "undefined") {
  throw new Error("ingest-knowledge must run on the server (Node.js), never in a browser.");
}

const SOURCE_TYPES: Array<DocumentSource["type"]> = [
  "website",
  "pdf",
  "manual",
  "faq",
  "blog",
  "case_study",
];

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(argv: string[]): IngestionSourceInput & { force: boolean } {
  const file = argValue(argv, "file");
  const title = argValue(argv, "title");
  if (!file || !title) {
    throw new Error("Missing required args: --file <path> --title <title>");
  }
  const sourceType = (argValue(argv, "source-type") ?? "manual") as DocumentSource["type"];
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(`Invalid --source-type (expected one of: ${SOURCE_TYPES.join(", ")})`);
  }
  const tags = (argValue(argv, "tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return {
    title,
    rawContent: "",
    sourceType,
    sourceUrl: argValue(argv, "source-url"),
    sourcePath: file,
    locale: argValue(argv, "locale") ?? "fr",
    tags,
    force: argv.includes("--force"),
  };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  const parsed = parseArgs(process.argv.slice(2));
  const rawContent = await readFile(parsed.sourcePath ?? "", "utf-8");

  const embeddingProvider = new NvidiaEmbeddingProvider();
  await embeddingProvider.initialize({
    apiKey: process.env["NVIDIA_NIM_API_KEY"] ?? "",
    baseUrl: process.env["NVIDIA_NIM_BASE_URL"] ?? "https://integrate.api.nvidia.com/v1",
    timeout: 120000,
    maxRetries: 2,
  });
  if (!embeddingProvider.isAvailable()) {
    throw new Error("Embedding provider unavailable: set NVIDIA_NIM_API_KEY.");
  }

  const repository = createKnowledgeRepository(getSupabaseAdmin());
  const result = await ingestDocument(
    { ...parsed, rawContent },
    {
      repository,
      embedTexts: (texts: string[]) => embeddingProvider.batchEmbed(texts),
    },
    { forceReindex: parsed.force },
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Usage + environment presence check. Prints whether each required server
 * variable is visible — NEVER their values.
 */
function printHelp(): void {
  const presence = (key: string): string => {
    const value = process.env[key];
    return value && value.length > 0 ? "set" : "MISSING";
  };
  console.log(`Webi knowledge ingestion (server only)

Usage:
  npx tsx scripts/ingest-knowledge.ts --file <path> --title <title> [options]

Options:
  --source-type <website|pdf|manual|faq|blog|case_study>  (default: manual)
  --source-url <url>
  --locale <locale>                                       (default: fr)
  --tags <a,b,c>
  --force                                                 (reindex if hash exists)
  --help, -h                                              (this message)

Environment (.env loaded via dotenv, values never printed):
  NVIDIA_NIM_API_KEY=${presence("NVIDIA_NIM_API_KEY")}
  VITE_SUPABASE_URL=${presence("VITE_SUPABASE_URL")}
  SUPABASE_SERVICE_ROLE_KEY=${presence("SUPABASE_SERVICE_ROLE_KEY")}
  NVIDIA_NIM_BASE_URL=${presence("NVIDIA_NIM_BASE_URL")}
  NVIDIA_NIM_EMBEDDING_MODEL=${presence("NVIDIA_NIM_EMBEDDING_MODEL")}`);
}
