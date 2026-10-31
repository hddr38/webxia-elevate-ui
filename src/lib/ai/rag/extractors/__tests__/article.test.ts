import { describe, it, expect } from "vitest";
import type { ArticleRow } from "../types";
import { extractArticle } from "../article";
import { MIN_CONTENT_CHARS } from "../types";
import { buildSourceKey, computeContentVersion } from "../../../contracts/source-key";

const baseRow: ArticleRow = {
  id: "a-1",
  title: "Audit SEO 2026",
  slug: "audit-seo-2026",
  content_md:
    "# Audit SEO 2026\n\nContenu de l'audit détaillé avec largement plus de deux cents caractères pour dépasser le seuil minimal de longueur imposé par l'extracteur et garantir que seul un contenu suffisamment riche soit ingéré dans la knowledge base RAG.",
  content_html: null,
  excerpt: null,
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
};

function row(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return { ...baseRow, ...overrides };
}

describe("extractArticle", () => {
  it("rejette les brouillons", async () => {
    expect(await extractArticle(row({ status: "draft" }))).toBeNull();
    expect(await extractArticle(row({ status: "archived" }))).toBeNull();
  });

  it("rejette le contenu trop court", async () => {
    const short = row({ content_md: "# Trop court" });
    expect(await extractArticle(short)).toBeNull();
  });

  it("rejette le slug vide", async () => {
    expect(await extractArticle(row({ slug: "" }))).toBeNull();
    expect(await extractArticle(row({ slug: "   " }))).toBeNull();
  });

  it("génère une identité valide avec le bon slug et la bonne URL", async () => {
    const doc = await extractArticle(row());

    expect(doc).not.toBeNull();
    expect(doc!.identity).toMatchObject({
      sourceType: "article",
      slug: "audit-seo-2026",
      locale: "fr",
    });
    expect(doc!.identity.version).toMatch(/^[0-9a-f]{12}$/);
    expect(doc!.sourceUrl).toBe("https://webxia.fr/journal/audit-seo-2026");
    expect(doc!.sourcePath).toBe("articles:audit-seo-2026");
    expect(doc!.title).toBe("Audit SEO 2026");
    expect(doc!.content).toContain("# Audit SEO 2026");
    expect(doc!.content).toContain(baseRow.content_md);
  });

  it("exclut content_html et autres champs non pertinents du metadata", async () => {
    const doc = await extractArticle(row());

    expect(doc!.metadata).not.toHaveProperty("content_html");
    expect(doc!.metadata).not.toHaveProperty("gallery_images");
    expect(doc!.metadata).not.toHaveProperty("project_url");
    expect(doc!.metadata).not.toHaveProperty("github_url");
  });

  it("contient au moins MIN_CONTENT_CHARS de contenu", async () => {
    const doc = await extractArticle(row());

    expect(doc!.content.length).toBeGreaterThanOrEqual(MIN_CONTENT_CHARS);
  });

  it("détecte la limite MIN_CONTENT_CHARS : exactement 200 accepté, 199 rejeté", async () => {
    const atLimit = row({ content_md: "x".repeat(MIN_CONTENT_CHARS) });
    expect(await extractArticle(atLimit)).not.toBeNull();

    const belowLimit = row({ content_md: "x".repeat(MIN_CONTENT_CHARS - 1) });
    expect(await extractArticle(belowLimit)).toBeNull();
  });

  it("la version change quand le contenu change, et reste stable sinon", async () => {
    const base = await extractArticle(row());
    const same = await extractArticle(row());
    const edited = await extractArticle(row({ content_md: `${baseRow.content_md} Édition.` }));

    expect(same!.identity.version).toBe(base!.identity.version);
    expect(edited!.identity.version).not.toBe(base!.identity.version);

    // La version est l'empreinte du contenu markdown seul (pas du titre).
    expect(base!.identity.version).toBe(await computeContentVersion(baseRow.content_md));
  });

  it("construit une source_key valide via buildSourceKey", async () => {
    const doc = await extractArticle(row());

    expect(buildSourceKey(doc!.identity)).toBe(
      `article:audit-seo-2026:fr:${doc!.identity.version}`,
    );
  });

  it("transporte tags, category, excerpt, readingMinutes, publishedAt dans metadata", async () => {
    const doc = await extractArticle(row());

    expect(doc!.metadata).toMatchObject({
      slug: "audit-seo-2026",
      tags: ["audit", "seo"],
      category: ["seo"],
      readingMinutes: 5,
      publishedAt: "2026-09-01T10:00:00Z",
    });
    expect(doc!.metadata["excerpt"]).toBeNull();
  });

  it("fonction pure : deux appels produisent le même document (déterminisme)", async () => {
    const a = await extractArticle(row());
    const b = await extractArticle(row());

    expect(a).toEqual(b);
  });
});
