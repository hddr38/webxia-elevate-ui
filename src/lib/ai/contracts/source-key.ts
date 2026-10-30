import { z } from "zod";

/**
 * Stable identity contract for WebXIA KNOWLEDGE DOCUMENTS (RAG).
 *
 * A knowledge document is NOT a memory: `ai_memory` rows are user-scoped and
 * ephemeral, `knowledge_documents` rows are corpus-scoped and versioned.
 * This contract describes the latter only.
 *
 * Identity key (stable, unambiguous, parsable):
 *
 *   source_key = `${sourceType}:${slug}:${locale}:${version}`
 *   example    = article:audit-seo:fr:3f9a1c2b7d44
 *
 * Rules:
 * - `slug` is restricted to `[a-z0-9-]` (slugify output) so `:` can never
 *   appear inside a segment: the key stays unambiguous and safely parsable;
 * - `locale` is part of the key: the FR and EN variants of the same slug are
 *   two DIFFERENT documents, never a collision;
 * - `version` is the fingerprint of the content (12 hex chars, see
 *   `computeContentVersion`): editing the content creates a new identity,
 *   editing only the metadata does not.
 *
 * Legacy documents (website, pdf, manual, faq, blog, case_study) have NO
 * stable identity: they are deduplicated by `content_hash` only (see
 * docs/rag/identity.md and migration 021).
 */

/** Business source types: documents with a stable, editable identity. */
export const MEMORY_SOURCE_TYPES = ["article", "realisation", "service"] as const;
export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];

/** Locales supported by the WebXIA content pipeline. */
export const MEMORY_SOURCE_LOCALES = ["fr", "en"] as const;
export type MemorySourceLocale = (typeof MEMORY_SOURCE_LOCALES)[number];

/**
 * Identity of one business document (article, realisation or service).
 *
 * The version is NOT a free-form label: it is the content fingerprint
 * produced by `computeContentVersion` (12 lowercase hex chars).
 */
export interface MemorySourceIdentity {
  sourceType: MemorySourceType;
  slug: string;
  locale: MemorySourceLocale;
  version: string;
}

/**
 * Version of the CONTENT NORMALIZATION used by `computeContentVersion`.
 *
 * STABILITY CONTRACT: if the normalization (or the fingerprint algorithm)
 * ever changes, this constant MUST be incremented AND a global re-ingestion
 * MUST be triggered: every previously computed version — and therefore every
 * `source_key` — becomes obsolete. See docs/rag/identity.md.
 */
export const NORMALIZE_VERSION = 1;

/** Runtime validation of a business identity. */
export const MemorySourceIdentitySchema = z
  .object({
    sourceType: z.enum(MEMORY_SOURCE_TYPES),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
    locale: z.enum(MEMORY_SOURCE_LOCALES),
    version: z.string().regex(/^[0-9a-f]{12}$/, "version must be a 12-hex content fingerprint"),
  })
  .strict();

const SOURCE_KEY_PATTERN = new RegExp(
  `^(${MEMORY_SOURCE_TYPES.join("|")}):([a-z0-9]+(?:-[a-z0-9]+)*):(${MEMORY_SOURCE_LOCALES.join(
    "|",
  )}):([0-9a-f]{12})$`,
);

/** Runtime validation of a `source_key` column value. */
export const SourceKeySchema = z
  .string()
  .regex(SOURCE_KEY_PATTERN, "source_key must be <sourceType>:<slug>:<locale>:<version>");

/**
 * Builds the stable identity key of a business document.
 * Throws (ZodError) when the identity is malformed — a malformed key would
 * silently corrupt the deduplication contract.
 */
export function buildSourceKey(identity: MemorySourceIdentity): string {
  const parsed = MemorySourceIdentitySchema.parse(identity);
  return `${parsed.sourceType}:${parsed.slug}:${parsed.locale}:${parsed.version}`;
}

/** Parses a `source_key` back into its identity (strict, never lossy). */
export function parseSourceKey(sourceKey: string): MemorySourceIdentity {
  const value = SourceKeySchema.parse(sourceKey);
  const [sourceType, slug, locale, version] = value.split(":");
  return MemorySourceIdentitySchema.parse({ sourceType, slug, locale, version });
}

/**
 * Content fingerprint used as the `version` segment of the identity key.
 *
 * Normalization (NORMALIZE_VERSION = 1): CRLF -> LF, then trim. The
 * fingerprint is the first 12 hex chars of the SHA-256 digest.
 */
export async function computeContentVersion(content: string): Promise<string> {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 12);
}
