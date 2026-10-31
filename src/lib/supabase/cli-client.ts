/**
 * CLI-only Supabase READ helpers (INGEST-3c) — server only.
 *
 * Used by `scripts/ingest-knowledge.ts` to fetch published `articles` /
 * `realisations` rows with robust pagination, then feed the pure extractors.
 *
 * Design rules:
 * - **Read-only**: `.select()` only, `status = 'published'` filtered at the
 *   source, ordered by the primary key `id` (unique + stable). No write path
 *   exists in this module.
 * - **No supabase-js runtime import**: the pagination loop is a pure function
 *   over an injectable page fetcher, so it is unit-testable without a client.
 * - **Secrets never printed**: env errors only mention variable NAMES.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const CLI_SOURCE_TABLES = ["articles", "realisations"] as const;
export type CliSourceTable = (typeof CLI_SOURCE_TABLES)[number];

export type CliSourceRow<T extends CliSourceTable> = Database["public"]["Tables"][T]["Row"];

/** Page size for `.range()` pagination (PostgREST caps a single page at 1000). */
export const CLI_PAGE_SIZE = 1000;

/**
 * Sort column per table, compile-time verified against BOTH source schemas:
 * `id` is the primary key of `articles` and `realisations`, hence unique and
 * stable — a secondary sort criterion is unnecessary (a unique key already
 * imposes a total order over rows, so `.range()` windows never overlap or
 * skip rows). If a migration ever renames the PK, `satisfies` fails typecheck.
 */
export const CLI_SORT_COLUMNS = {
  articles: "id",
  realisations: "id",
} as const satisfies Record<
  CliSourceTable,
  keyof CliSourceRow<"articles"> & keyof CliSourceRow<"realisations">
>;

/** One page result, mirroring the PostgREST shape (data + error). */
export interface CliPageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Injectable page fetcher: `(from, to) => page` with `to` INCLUSIVE. */
export type CliPageFetcher<T> = (from: number, to: number) => Promise<CliPageResult<T>>;

export type CliSourceErrorCode = "MISSING_ENV" | "DB_QUERY_FAILED";

/** Typed CLI source error (never carries secret values). */
export class CliSourceError extends Error {
  readonly code: CliSourceErrorCode;
  constructor(code: CliSourceErrorCode, message: string) {
    super(message);
    this.name = "CliSourceError";
    this.code = code;
  }
}

export interface CliSupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

/**
 * Validates the environment required to READ source rows.
 * STOP with an explicit error naming the missing variables — values and
 * secrets are never included in the message.
 */
export function requireCliSourceEnv(env: NodeJS.ProcessEnv = process.env): CliSupabaseEnv {
  const url = env["VITE_SUPABASE_URL"] ?? "";
  const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (url.length === 0 || serviceRoleKey.length === 0) {
    const missing: string[] = [];
    if (url.length === 0) missing.push("VITE_SUPABASE_URL");
    if (serviceRoleKey.length === 0) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    throw new CliSourceError(
      "MISSING_ENV",
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in .env (values are never printed).`,
    );
  }
  return { url, serviceRoleKey };
}

/**
 * Robust pagination loop: keeps requesting `.range()` pages of `pageSize`
 * until a page returns FEWER rows than requested (the documented stop
 * condition). Never assumes a single query returns everything.
 *
 * - 0 rows      -> 1 query
 * - 1..N<pSize -> 1 query
 * - exactly N   -> 1 + 1 query (the extra empty page confirms the end)
 * - N+1..       -> ceil((N+1)/pageSize) + ... until a short page
 *
 * Any query error or transport failure (timeout, abort) throws a typed
 * `CliSourceError` — raw Supabase errors never leak to the caller.
 */
export async function fetchAllPublishedRows<T>(
  fetchPage: CliPageFetcher<T>,
  options: { pageSize?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? CLI_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`fetchAllPublishedRows: pageSize must be a positive integer, got ${pageSize}`);
  }
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    let page: CliPageResult<T>;
    try {
      page = await fetchPage(from, from + pageSize - 1);
    } catch (error) {
      throw new CliSourceError(
        "DB_QUERY_FAILED",
        `Supabase read failed (range ${from}-${from + pageSize - 1}): ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
    if (page.error) {
      throw new CliSourceError("DB_QUERY_FAILED", `Supabase query error: ${page.error.message}`);
    }
    const chunk = page.data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break; // short page = last page
    from += pageSize;
  }
  return rows;
}

/**
 * Builds a page fetcher over the admin client for one source table:
 * `select * where status = 'published' order by id asc range(from, to)`.
 *
 * The filter is applied AT THE SOURCE so drafts/archived rows never leave
 * the database, and the sort uses the primary key (see `CLI_SORT_COLUMNS`).
 *
 * Overloads pin each table as a literal — supabase-js cannot type-check
 * `.eq("status", ...)` against a generic table name.
 */
export function createPublishedPageFetcher(
  client: SupabaseClient<Database>,
  table: "articles",
): CliPageFetcher<CliSourceRow<"articles">>;
export function createPublishedPageFetcher(
  client: SupabaseClient<Database>,
  table: "realisations",
): CliPageFetcher<CliSourceRow<"realisations">>;
export function createPublishedPageFetcher(
  client: SupabaseClient<Database>,
  table: CliSourceTable,
): CliPageFetcher<CliSourceRow<CliSourceTable>> {
  const sortColumn = CLI_SORT_COLUMNS[table];
  const queryPage = async (
    from: number,
    to: number,
  ): Promise<{ data: CliSourceRow<CliSourceTable>[] | null; error: { message: string } | null }> =>
    table === "articles"
      ? client
          .from("articles")
          .select("*")
          .eq("status", "published")
          .order(sortColumn, { ascending: true })
          .range(from, to)
      : client
          .from("realisations")
          .select("*")
          .eq("status", "published")
          .order(sortColumn, { ascending: true })
          .range(from, to);

  return async (from: number, to: number): Promise<CliPageResult<CliSourceRow<CliSourceTable>>> => {
    const response = await queryPage(from, to);
    // supabase-js responses are structurally `{ data, error }` (PostgrestError
    // carries `message`); the cast documents that runtime contract.
    return response as CliPageResult<CliSourceRow<CliSourceTable>>;
  };
}
