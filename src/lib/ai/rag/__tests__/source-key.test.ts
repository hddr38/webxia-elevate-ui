import { describe, it, expect } from "vitest";
import {
  NORMALIZE_VERSION,
  SourceKeySchema,
  buildSourceKey,
  computeContentVersion,
  parseSourceKey,
  type MemorySourceIdentity,
} from "../../contracts/source-key";

const IDENTITY: MemorySourceIdentity = {
  sourceType: "article",
  slug: "audit-seo",
  locale: "fr",
  version: "3f9a1c2b7d44",
};

describe("buildSourceKey", () => {
  it("is deterministic: the same identity always yields the same key", () => {
    expect(buildSourceKey(IDENTITY)).toBe("article:audit-seo:fr:3f9a1c2b7d44");
    expect(buildSourceKey({ ...IDENTITY })).toBe(buildSourceKey(IDENTITY));
  });

  it("changes when the version changes (new content revision)", () => {
    const previous = buildSourceKey(IDENTITY);
    const next = buildSourceKey({ ...IDENTITY, version: "a1b2c3d4e5f6" });

    expect(next).not.toBe(previous);
    expect(next).toBe("article:audit-seo:fr:a1b2c3d4e5f6");
  });

  it("separates the locales (FR and EN are two documents)", () => {
    expect(buildSourceKey({ ...IDENTITY, locale: "en" })).not.toBe(buildSourceKey(IDENTITY));
  });

  it("rejects a malformed identity instead of building an ambiguous key", () => {
    expect(() => buildSourceKey({ ...IDENTITY, slug: "audit:seo" })).toThrow();
    expect(() => buildSourceKey({ ...IDENTITY, slug: "Audit SEO" })).toThrow();
    expect(() => buildSourceKey({ ...IDENTITY, locale: "de" as "fr" })).toThrow();
    expect(() => buildSourceKey({ ...IDENTITY, version: "not-a-fingerprint" })).toThrow();
  });
});

describe("SourceKeySchema", () => {
  it("accepts a well-formed key", () => {
    const parsed = SourceKeySchema.safeParse("article:audit-seo:fr:3f9a1c2b7d44");

    expect(parsed.success).toBe(true);
  });

  it("rejects malformed keys", () => {
    const invalid = [
      "",
      "article:audit-seo:fr",
      "article:audit-seo:fr:3f9a1c2b7d44:extra",
      "website:audit-seo:fr:3f9a1c2b7d44",
      "article:audit-seo:de:3f9a1c2b7d44",
      "article:AuditSEO:fr:3f9a1c2b7d44",
      "article:audit-seo:fr:3F9A1C2B7D44",
      "article:audit-seo:fr:3f9a1c2b7d",
    ];

    for (const key of invalid) {
      expect(SourceKeySchema.safeParse(key).success, key).toBe(false);
    }
  });

  it("round-trips a key into its identity", () => {
    expect(parseSourceKey("article:audit-seo:fr:3f9a1c2b7d44")).toEqual(IDENTITY);
  });
});

describe("computeContentVersion", () => {
  it("returns a 12-hex fingerprint", async () => {
    const version = await computeContentVersion("# Audit\n\nContenu.");

    expect(version).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is stable and content-sensitive", async () => {
    const a = await computeContentVersion("contenu");
    const b = await computeContentVersion("contenu");
    const c = await computeContentVersion("autre contenu");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("ignores CRLF line endings and surrounding whitespace", async () => {
    const unix = await computeContentVersion("ligne 1\nligne 2");
    const windows = await computeContentVersion("  ligne 1\r\nligne 2  ");

    expect(windows).toBe(unix);
  });
});

describe("NORMALIZE_VERSION", () => {
  it("is versioned: any change of the normalization must bump it", () => {
    expect(NORMALIZE_VERSION).toBe(1);
  });
});
