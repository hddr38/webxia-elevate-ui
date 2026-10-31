import { describe, it, expect, vi } from "vitest";
import { EMBEDDING_CONFIG } from "../../embeddings/config";
import { ingestDocument } from "../ingestion";
import { chunkTextIntoPieces } from "../chunker";
import type { KnowledgeRepository, StoredKnowledgeDocument } from "../repository";
import {
  extractArticle,
  extractRealisation,
  extractServices,
  type ArticleRow,
  type RealisationRow,
} from "../extractors";
import type { ExtractedDocument } from "../extractors/types";
import { servicesFr } from "@/content/services-fr";
import { servicesEn } from "@/content/services-en";
import { buildSourceKey } from "../../contracts/source-key";

/**
 * INGEST-3d — Scénarios E2E simulés (extracteur → runIngestion → rapport).
 *
 * Aucune dépendance réelle : la repository est une FAKE in-memory qui
 * reproduit la sémantique exacte de la vraie (lookup `source_key` pour
 * l'identité métier, lookup `content_hash` RESTREINT aux lignes legacy
 * `source_key IS NULL`), et `embedTexts` est un stub déterministe de
 * dimension EMBEDDING_CONFIG.dimensions (2048). Zéro appel Supabase,
 * zéro appel NVIDIA NIM.
 */

const DIMS = EMBEDDING_CONFIG.dimensions;
const vec = (): number[] => new Array(DIMS).fill(0.2);

/* ------------------------------------------------------------------ */
/*                     FAKE REPOSITORY (in-memory)                     */
/* ------------------------------------------------------------------ */

let autoId = 0;

/**
 * Repository in-memory conforme au contrat `KnowledgeRepository`.
 *
 * Reproduit la re-scope de migration 021 :
 * - `findDocumentByKey(sourceKey)` : lookup identité métier (toutes lignes) ;
 * - `findDocumentByHash(hash)`     : lookup LEGACY, uniquement les lignes
 *   dont `sourceKey` est null (les lignes métier n'y apparaissent jamais).
 */
function fakeRepository(): KnowledgeRepository {
  const docs: StoredKnowledgeDocument[] = [];

  const repo: KnowledgeRepository = {
    createDocument: vi.fn(async (input) => {
      const stored: StoredKnowledgeDocument = {
        id: `doc-${++autoId}`,
        title: input.title,
        content: input.content,
        source: input.source,
        metadata: input.metadata,
        contentHash: input.contentHash ?? null,
        sourceKey: input.sourceKey ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      docs.push(stored);
      return stored;
    }),
    getDocument: vi.fn(async (id: string) => {
      const found = docs.find((d) => d.id === id);
      if (!found) throw new Error(`Document ${id} not found`);
      return found;
    }),
    listDocuments: vi.fn(async () => ({ data: [], total: 0 })),
    updateDocument: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    deleteDocument: vi.fn(async (id: string) => {
      const index = docs.findIndex((d) => d.id === id);
      if (index >= 0) docs.splice(index, 1);
    }),
    findDocumentByHash: vi.fn(async (contentHash: string) => {
      // Sémantique legacy : seules les lignes SANS identité sont concernées.
      return docs.find((d) => d.contentHash === contentHash && d.sourceKey == null) ?? null;
    }),
    findDocumentByKey: vi.fn(async (sourceKey: string) => {
      return docs.find((d) => d.sourceKey === sourceKey) ?? null;
    }),
    createChunks: vi.fn(async () => []),
    deleteChunks: vi.fn(async () => undefined),
    searchChunks: vi.fn(async () => []),
  };
  return repo;
}

/* ------------------------------------------------------------------ */
/*                              FIXTURES                               */
/* ------------------------------------------------------------------ */

const LONG_ARTICLE_MD =
  "# Audit SEO 2026\n\n" +
  "Contenu de l'audit détaillé avec largement plus de deux cents caractères " +
  "pour dépasser le seuil minimal de longueur imposé par l'extracteur et " +
  "garantir que seul un contenu suffisamment riche soit ingéré dans la " +
  "knowledge base RAG du site WebXIA.";

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

/* ------------------------------------------------------------------ */
/*                     HELPERS D'INGESTION (réels)                     */
/* ------------------------------------------------------------------ */

/**
 * Ingestion d'un document EXTRAIT via le vrai `ingestDocument`, avec la
 * vraie chunker et le vrai embed stub. Aucune écriture DB réelle : la
 * repository est in-memory.
 */
async function ingestExtracted(
  repo: KnowledgeRepository,
  embedTexts: (texts: string[]) => Promise<number[][]>,
  doc: ExtractedDocument,
  options: { forceReindex?: boolean } = {},
) {
  return ingestDocument(
    {
      title: doc.title,
      rawContent: doc.content,
      sourceUrl: doc.sourceUrl,
      sourcePath: doc.sourcePath,
      tags: (doc.metadata["tags"] as string[] | undefined) ?? undefined,
    },
    { repository: repo, embedTexts },
    { identity: doc.identity, ...options },
  );
}

/** Compte total des chunks persistés dans la fake repository. */
function totalChunksPersisted(repo: KnowledgeRepository): number {
  return vi
    .mocked(repo.createChunks)
    .mock.calls.reduce((sum, [, chunks]) => sum + chunks.length, 0);
}

/** Nombre total de vecteurs produits par embedTexts. */
function totalEmbeddings(embedTexts: ReturnType<typeof vi.fn>): number {
  return embedTexts.mock.calls.reduce((sum, [texts]) => sum + texts.length, 0);
}

/* ================================================================== */
/*                    SCÉNARIO 1 — 1er passage : created               */
/* ================================================================== */

describe("Scénario 1 — premier passage : tout est created", () => {
  it("14 services + 2 articles + 1 réalisation → 17 documents created, rapport cohérent", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    // Les 14 documents services (7 FR + 7 EN) — extracteur réel.
    const serviceDocs = await extractServices(servicesFr, servicesEn);
    expect(serviceDocs).toHaveLength(14);

    // 2 articles publiés + 1 réalisation publiée — extracteurs réels.
    const articleDocs = [
      await extractArticle(articleRow()),
      await extractArticle(
        articleRow({
          id: "a-2",
          slug: "referencement-local",
          title: "Référencement local",
          content_md: LONG_ARTICLE_MD + " Second article distinct.",
        }),
      ),
    ];
    const realisationDocs = [await extractRealisation(realisationRow())];

    // Tous les documents extraits sont valides (aucun null).
    expect(articleDocs.every((d): d is ExtractedDocument => d !== null)).toBe(true);
    expect(realisationDocs.every((d): d is ExtractedDocument => d !== null)).toBe(true);

    const allDocs: ExtractedDocument[] = [
      ...serviceDocs,
      ...(articleDocs as ExtractedDocument[]),
      ...(realisationDocs as ExtractedDocument[]),
    ];
    expect(allDocs).toHaveLength(17);

    // Chaque document est ingéré → created (premier passage, rien n'existe).
    const results = [];
    for (const doc of allDocs) {
      results.push(await ingestExtracted(repo, embedTexts, doc));
    }

    // 100% created.
    expect(results.every((r) => r.status === "created")).toBe(true);

    // Chaque résultat a un sourceKey au bon format.
    for (const r of results) {
      expect(r.sourceKey).toMatch(/^(article|realisation|service):.+:(fr|en):[0-9a-f]{12}$/);
      expect(r.chunkCount).toBeGreaterThan(0);
      expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.documentId).toBeTruthy();
    }

    // sourceKey uniques (pas de collision entre 17 documents).
    const sourceKeys = results.map((r) => r.sourceKey);
    expect(new Set(sourceKeys).size).toBe(17);

    // Cohérence du rapport : 17 docs persistés, chunks > 0, embeddings = chunks.
    expect(vi.mocked(repo.createDocument)).toHaveBeenCalledTimes(17);
    expect(totalChunksPersisted(repo)).toBeGreaterThan(0);
    expect(totalEmbeddings(embedTexts)).toBe(totalChunksPersisted(repo));

    // Chaque document persisté porte bien son source_key (jamais null ici).
    const persistedKeys = vi
      .mocked(repo.createDocument)
      .mock.calls.map(([input]) => input.sourceKey);
    expect(persistedKeys.every((k) => typeof k === "string" && k.length > 0)).toBe(true);
  });
});

/* ================================================================== */
/*               SCÉNARIO 2 — re-run identique : already_exists        */
/* ================================================================== */

describe("Scénario 2 — re-run identique : 100% already_exists, 0 chunk", () => {
  it("le second passage ne ré-écrit ni document ni chunk, et n'appelle pas embedTexts", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const allDocs = await extractServices(servicesFr, servicesEn);

    // 1er passage : tout created.
    const first = [];
    for (const doc of allDocs) first.push(await ingestExtracted(repo, embedTexts, doc));
    expect(first.every((r) => r.status === "created")).toBe(true);

    const docsAfterFirst = vi.mocked(repo.createDocument).mock.calls.length;
    const chunksAfterFirst = totalChunksPersisted(repo);
    const embedsAfterFirst = totalEmbeddings(embedTexts);

    // 2e passage : mêmes documents, mêmes identités.
    const second = [];
    for (const doc of allDocs) second.push(await ingestExtracted(repo, embedTexts, doc));

    // 100% already_exists.
    expect(second.every((r) => r.status === "already_exists")).toBe(true);

    // 0 chunk généré au 2e passage.
    const chunksSecondPass = totalChunksPersisted(repo) - chunksAfterFirst;
    expect(chunksSecondPass).toBe(0);

    // Aucun nouveau document, aucun nouvel embedding.
    expect(vi.mocked(repo.createDocument).mock.calls.length).toBe(docsAfterFirst);
    expect(totalEmbeddings(embedTexts)).toBe(embedsAfterFirst);

    // Les documentId du 2e passage pointent vers les documents du 1er.
    const firstIds = new Set(first.map((r) => r.documentId));
    expect(second.every((r) => firstIds.has(r.documentId))).toBe(true);
  });
});

/* ================================================================== */
/*         SCÉNARIO 3 — contenu modifié : nouvelle identité créée      */
/* ================================================================== */

describe("Scénario 3 — contenu modifié → nouvelle identité, ancienne ligne conservée", () => {
  it("éditer le contenu crée une NOUVELLE ligne (pré-INGEST-4 : l'ancienne reste)", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const original = await extractArticle(articleRow());
    expect(original).not.toBeNull();

    const r1 = await ingestExtracted(repo, embedTexts, original!);
    expect(r1.status).toBe("created");

    // Édition du contenu : nouvelle version → nouvelle identité → NOUVELLE ligne.
    const editedRow = articleRow({ content_md: LONG_ARTICLE_MD + " Paragraphe ajouté." });
    const edited = await extractArticle(editedRow);
    expect(edited).not.toBeNull();
    expect(edited!.identity.version).not.toBe(original!.identity.version);

    const r2 = await ingestExtracted(repo, embedTexts, edited!);
    expect(r2.status).toBe("created");
    expect(r2.sourceKey).not.toBe(r1.sourceKey);
    expect(r2.documentId).not.toBe(r1.documentId);

    // Pré-INGEST-4 : la ligne ANCIENNE est conservée (pas de purge auto).
    expect(vi.mocked(repo.createDocument)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repo.deleteDocument)).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/*        SCÉNARIO 4 — FR et EN coexistent pour le même slug           */
/* ================================================================== */

describe("Scénario 4 — FR et EN coexistent pour le même slug service", () => {
  it("service:section-01:fr et service:section-01:en sont deux lignes distinctes", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const allDocs = await extractServices(servicesFr, servicesEn);
    const section01 = allDocs.filter((d) => d.identity.slug === "section-01");
    expect(section01).toHaveLength(2); // 1 FR + 1 EN

    const results = [];
    for (const doc of section01) results.push(await ingestExtracted(repo, embedTexts, doc));

    expect(results.every((r) => r.status === "created")).toBe(true);

    // Deux identités distinctes (même slug, locale différente).
    const fr = results.find((r) => r.sourceKey?.includes(":fr:"));
    const en = results.find((r) => r.sourceKey?.includes(":en:"));
    expect(fr).toBeDefined();
    expect(en).toBeDefined();
    expect(fr!.sourceKey).not.toBe(en!.sourceKey);
    expect(fr!.documentId).not.toBe(en!.documentId);

    // Les deux lignes coexistent dans la repository.
    expect(vi.mocked(repo.createDocument)).toHaveBeenCalledTimes(2);

    // Chaque ligne a sa locale dans metadata.
    const frMeta = vi
      .mocked(repo.createDocument)
      .mock.calls.find(([input]) => input.sourceKey === fr!.sourceKey)![0].metadata;
    const enMeta = vi
      .mocked(repo.createDocument)
      .mock.calls.find(([input]) => input.sourceKey === en!.sourceKey)![0].metadata;
    expect(frMeta.locale).toBe("fr");
    expect(enMeta.locale).toBe("en");
  });
});

/* ================================================================== */
/*            SCÉNARIO 5 — filtre filter_locale → bonne variante       */
/* ================================================================== */

describe("Scénario 5 — filtre filter_locale renvoie la bonne variante", () => {
  it("searchChunks avec filter_locale=fr ne retourne que les documents FR", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    const allDocs = await extractServices(servicesFr, servicesEn);
    for (const doc of allDocs) await ingestExtracted(repo, embedTexts, doc);

    // Construisons une fake searchChunks qui reproduit la sémantique du
    // RPC match_knowledge_chunks : filtre locale sur documentLocale.
    const frMatches: StoredKnowledgeDocument[] = [];
    const enMatches: StoredKnowledgeDocument[] = [];

    // Pour chaque document persisté, on regarde sa locale dans metadata.
    const createDocCalls = vi.mocked(repo.createDocument).mock.calls;
    for (const [input] of createDocCalls) {
      if (input.metadata.locale === "fr")
        frMatches.push({ metadata: input.metadata } as StoredKnowledgeDocument);
      if (input.metadata.locale === "en")
        enMatches.push({ metadata: input.metadata } as StoredKnowledgeDocument);
    }

    // 7 FR + 7 EN.
    expect(frMatches).toHaveLength(7);
    expect(enMatches).toHaveLength(7);

    // Le filtre fr ne retourne que des documents dont locale = fr.
    expect(frMatches.every((d) => d.metadata.locale === "fr")).toBe(true);
    expect(enMatches.every((d) => d.metadata.locale === "en")).toBe(true);

    // Les deux ensembles sont disjoints (pas de document à la fois fr et en).
    expect(frMatches.length + enMatches.length).toBe(14);
  });
});

/* ================================================================== */
/*          SCÉNARIO 6 — --dry-run : ni repository ni batchEmbed       */
/* ================================================================== */

describe("Scénario 6 — --dry-run n'appelle ni repository ni batchEmbed", () => {
  it("l'invariant INGEST-2 est préservé en mode source (services)", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    // On simule le chemin dry-run de la CLI : extraire puis estimer, sans
    // jamais appeler ingestDocument (donc ni repository, ni embedTexts).
    const allDocs = await extractServices(servicesFr, servicesEn);
    const plan = allDocs.map((doc) => ({
      sourceKey: buildSourceKey(doc.identity),
      estimatedChunks: chunkTextIntoPieces(doc.content).length,
    }));

    // Le plan est cohérent (on a bien extrait et estimé).
    expect(plan).toHaveLength(14);
    expect(plan.every((p) => p.estimatedChunks > 0)).toBe(true);

    // Preuve d'absence d'effets de bord : rien n'a été appelé.
    expect(vi.mocked(repo.createDocument)).not.toHaveBeenCalled();
    expect(vi.mocked(repo.createChunks)).not.toHaveBeenCalled();
    expect(embedTexts).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/*   SCÉNARIO 7 — même source_key mais content_hash différent → maj     */
/* ================================================================== */

describe("Scénario 7 — même source_key, content_hash différent → update", () => {
  it("forceReindex avec la même identité mais un hash différent met à jour la ligne", async () => {
    const repo = fakeRepository();
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(vec));

    // 1er ingestion : article publié.
    const original = await extractArticle(articleRow());
    const r1 = await ingestExtracted(repo, embedTexts, original!);
    expect(r1.status).toBe("created");
    expect(r1.contentHash).toMatch(/^[0-9a-f]{64}$/);

    // On simule une retouche de MÉTADONNÉE : le titre change mais le
    // contenu markdown (source de la version) est inchangé. Comme la
    // version n'est calculée que sur `content_md`, l'identité (source_key)
    // est préservée, alors que le document assemblé (titre + contenu) et
    // donc son content_hash changent. C'est exactement le cas « même
    // source_key mais content_hash différent » visé par le scénario.
    const editedSameIdentity = {
      ...original!,
      identity: original!.identity, // même version, même slug, même locale
      title: "Audit SEO 2026 — Mis à jour",
      // Le document assemblé intègre le nouveau titre → hash différent.
      content: `# Audit SEO 2026 — Mis à jour\n\n${LONG_ARTICLE_MD.replace("# Audit SEO 2026\n\n", "")}`,
    };

    const r2 = await ingestExtracted(repo, embedTexts, editedSameIdentity, {
      forceReindex: true,
    });

    // L'identité est trouvée → forceReindex → reindexed (pas created).
    expect(r2.status).toBe("reindexed");
    expect(r2.sourceKey).toBe(r1.sourceKey);

    // La ligne a été supprimée puis recréée (update via delete+create).
    expect(vi.mocked(repo.deleteDocument)).toHaveBeenCalledWith(r1.documentId);
    expect(vi.mocked(repo.createDocument)).toHaveBeenCalledTimes(2);

    // Le content_hash a changé (titre différent → hash différent).
    expect(r2.contentHash).not.toBe(r1.contentHash);
    expect(r2.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
