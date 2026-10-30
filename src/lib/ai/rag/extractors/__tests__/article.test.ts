import { describe, it, expect } from "vitest";
import type { ArticleRow } from "../types";
import { extractArticle } from "../article";
import { MIN_CONTENT_CHARS } from "../types";

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
});
