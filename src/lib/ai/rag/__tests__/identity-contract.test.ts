import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  NORMALIZE_VERSION,
  MEMORY_SOURCE_TYPES,
  MEMORY_SOURCE_LOCALES,
  MemorySourceIdentitySchema,
  SourceKeySchema,
  buildSourceKey,
  computeContentVersion,
  parseSourceKey,
  type MemorySourceIdentity,
} from "../../contracts/source-key";

/**
 * INGEST-3d — Tests contrat d'identité.
 *
 * Portée : `buildSourceKey` (format, stabilité, round-trip), collisions
 * (contenus/slug/locale/types distincts), sensibilité au contenu (nouvelle
 * version → nouvelle clé) et validation Zod du format
 * `sourceType:slug:locale:version` (slug sans `:`, locale `fr|en`,
 * version 12-hex). Complète `source-key.test.ts` sans le doubler.
 */

const IDENTITY: MemorySourceIdentity = {
  sourceType: "article",
  slug: "audit-seo",
  locale: "fr",
  version: "3f9a1c2b7d44",
};

describe("buildSourceKey — format et stabilité", () => {
  it("émet le format <sourceType>:<slug>:<locale>:<version>", () => {
    expect(buildSourceKey(IDENTITY)).toBe("article:audit-seo:fr:3f9a1c2b7d44");
  });

  it("est stable : la même identité produit toujours la même clé (round-trip de calls)", () => {
    const calls = [buildSourceKey(IDENTITY), buildSourceKey(IDENTITY), buildSourceKey(IDENTITY)];
    expect(new Set(calls).size).toBe(1);
  });

  it("n'altère aucun segment (les 4 segments traversent intacts)", () => {
    const key = buildSourceKey(IDENTITY);
    const segments = key.split(":");
    expect(segments).toEqual(["article", "audit-seo", "fr", "3f9a1c2b7d44"]);
  });

  it("round-trip complet : parseSourceKey(buildSourceKey(id)) === id", () => {
    expect(parseSourceKey(buildSourceKey(IDENTITY))).toEqual(IDENTITY);
  });

  it("round-trip pour les 3 types métier", () => {
    for (const sourceType of MEMORY_SOURCE_TYPES) {
      const identity: MemorySourceIdentity = { ...IDENTITY, sourceType };
      expect(parseSourceKey(buildSourceKey(identity))).toEqual(identity);
    }
  });
});

describe("buildSourceKey — collisions", () => {
  it("deux contenus différents (versions différentes) → deux clés différentes", () => {
    const a = buildSourceKey({ ...IDENTITY, version: "aaaaaaaaaaaa" });
    const b = buildSourceKey({ ...IDENTITY, version: "bbbbbbbbbbbb" });
    expect(a).not.toBe(b);
  });

  it("deux slug différents → deux clés différentes", () => {
    const a = buildSourceKey({ ...IDENTITY, slug: "audit-seo" });
    const b = buildSourceKey({ ...IDENTITY, slug: "refonte-site" });
    expect(a).not.toBe(b);
  });

  it("deux locales différents → deux clés différentes (FR et EN sont deux documents)", () => {
    const fr = buildSourceKey({ ...IDENTITY, locale: "fr" });
    const en = buildSourceKey({ ...IDENTITY, locale: "en" });
    expect(fr).not.toBe(en);
  });

  it("deux types métier différents → deux clés différentes", () => {
    const article = buildSourceKey({ ...IDENTITY, sourceType: "article" });
    const service = buildSourceKey({ ...IDENTITY, sourceType: "service" });
    const realisation = buildSourceKey({ ...IDENTITY, sourceType: "realisation" });
    expect(new Set([article, service, realisation]).size).toBe(3);
  });
});

describe("buildSourceKey — sensibilité à la version du contenu", () => {
  it("un changement de version crée une nouvelle clé (re-index)", () => {
    const v1 = buildSourceKey({ ...IDENTITY, version: "111111111111" });
    const v2 = buildSourceKey({ ...IDENTITY, version: "222222222222" });
    expect(v2).not.toBe(v1);
  });

  it("computeContentVersion dérive une nouvelle version d'un contenu modifié", async () => {
    const original = await computeContentVersion("# Titre\n\nContenu v1");
    const modified = await computeContentVersion("# Titre\n\nContenu v2");
    expect(modified).not.toBe(original);
  });

  it("computeContentVersion est stable sur un contenu identique", async () => {
    const a = await computeContentVersion("# Titre\n\nContenu");
    const b = await computeContentVersion("# Titre\n\nContenu");
    expect(a).toBe(b);
  });

  it("computeContentVersion ignore CRLF et espaces de bord (normalisation v1)", async () => {
    const unix = await computeContentVersion("ligne 1\nligne 2");
    const windows = await computeContentVersion("  ligne 1\r\nligne 2  ");
    expect(windows).toBe(unix);
  });
});

describe("SourceKeySchema — validation du format", () => {
  it("accepte une clé bien formée", () => {
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:3f9a1c2b7d44").success).toBe(true);
    expect(SourceKeySchema.safeParse("service:section-01:en:0123456789ab").success).toBe(true);
    expect(SourceKeySchema.safeParse("realisation:site-acme:fr:deadbeef0000").success).toBe(true);
  });

  it("rejette un slug contenant ':' (ambiguïté de parsing)", () => {
    expect(SourceKeySchema.safeParse("article:audit:seo:fr:3f9a1c2b7d44").success).toBe(false);
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:3f9a1c2b7d44:extra").success).toBe(
      false,
    );
  });

  it("rejette une locale hors {fr,en}", () => {
    expect(SourceKeySchema.safeParse("article:audit-seo:de:3f9a1c2b7d44").success).toBe(false);
    expect(SourceKeySchema.safeParse("article:audit-seo:es:3f9a1c2b7d44").success).toBe(false);
    expect(SourceKeySchema.safeParse("article:audit-seo::3f9a1c2b7d44").success).toBe(false);
  });

  it("rejette une version qui n'est pas une empreinte 12-hex", () => {
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:3F9A1C2B7D44").success).toBe(false); // majuscules
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:3f9a1c2b7d").success).toBe(false); // 10 hex
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:3f9a1c2b7d445566").success).toBe(false); // 16 hex
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:version-lisible").success).toBe(false); // non hex
    expect(SourceKeySchema.safeParse("article:audit-seo:fr:").success).toBe(false); // vide
  });

  it("rejette un sourceType hors des types métier", () => {
    expect(SourceKeySchema.safeParse("website:audit-seo:fr:3f9a1c2b7d44").success).toBe(false);
    expect(SourceKeySchema.safeParse("pdf:audit-seo:fr:3f9a1c2b7d44").success).toBe(false);
    expect(SourceKeySchema.safeParse("blog:audit-seo:fr:3f9a1c2b7d44").success).toBe(false);
  });

  it("rejette les formes vides et tronquées", () => {
    expect(SourceKeySchema.safeParse("").success).toBe(false);
    expect(SourceKeySchema.safeParse("article:audit-seo:fr").success).toBe(false);
    expect(SourceKeySchema.safeParse(":::").success).toBe(false);
  });
});

describe("MemorySourceIdentitySchema — validation de l'identité", () => {
  it("accepte une identité valide", () => {
    expect(MemorySourceIdentitySchema.safeParse(IDENTITY).success).toBe(true);
  });

  it("rejette un slug non kebab-case (majuscules, espaces, underscores)", () => {
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, slug: "Audit SEO" }).success).toBe(
      false,
    );
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, slug: "audit_seo" }).success).toBe(
      false,
    );
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, slug: "Audit-SEO" }).success).toBe(
      false,
    );
  });

  it("rejette un slug vide ou > 200 caractères", () => {
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, slug: "" }).success).toBe(false);
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, slug: "   " }).success).toBe(false);
    expect(
      MemorySourceIdentitySchema.safeParse({ ...IDENTITY, slug: "a".repeat(201) }).success,
    ).toBe(false);
  });

  it("rejette une locale hors {fr,en} et un type hors métier", () => {
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, locale: "de" }).success).toBe(false);
    expect(
      MemorySourceIdentitySchema.safeParse({ ...IDENTITY, sourceType: "website" }).success,
    ).toBe(false);
  });

  it("rejette une version non conforme (regex 12-hex)", () => {
    expect(
      MemorySourceIdentitySchema.safeParse({ ...IDENTITY, version: "not-a-fingerprint" }).success,
    ).toBe(false);
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, version: "" }).success).toBe(false);
  });

  it("est strict : un champ inconnu est rejeté", () => {
    expect(MemorySourceIdentitySchema.safeParse({ ...IDENTITY, extra: "surprise" }).success).toBe(
      false,
    );
  });

  it("buildSourceKey lève une ZodError sur une identité invalide (clé ambiguë refusée)", () => {
    expect(() => buildSourceKey({ ...IDENTITY, slug: "audit:seo" })).toThrow(z.ZodError);
    expect(() => buildSourceKey({ ...IDENTITY, version: "abc" })).toThrow(z.ZodError);
  });
});

describe("NORMALIZE_VERSION — contrat de stabilité", () => {
  it("vaut 1 (toute modification de la normalisation doit le bump + re-index global)", () => {
    expect(NORMALIZE_VERSION).toBe(1);
  });

  it("les tables de constantes métier sont figées (article|realisation|service et fr|en)", () => {
    expect([...MEMORY_SOURCE_TYPES]).toEqual(["article", "realisation", "service"]);
    expect([...MEMORY_SOURCE_LOCALES]).toEqual(["fr", "en"]);
  });
});
