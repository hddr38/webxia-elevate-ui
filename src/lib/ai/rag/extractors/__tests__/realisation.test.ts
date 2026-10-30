import { describe, it, expect } from "vitest";
import type { RealisationRow } from "../types";
import { extractRealisation } from "../realisation";

const baseRow: RealisationRow = {
  id: "r-1",
  title: "Site vitrine Acme",
  slug: "site-vitrine-acme",
  description_md:
    "# Site vitrine Acme\n\nContenu détaillé de la réalisation pour la société Acme. Ce site vitrine moderne est optimisé pour la conversion et présente les services de l'entreprise de manière claire et professionnelle. Il dépasse largement le seuil minimal de deux cents caractères imposé par l'extracteur pour garantir que seuls les documents suffisamment riches soient ingérés dans la knowledge base RAG.",
  description_html: null,
  short_description: "Site vitrine moderne pour la société Acme, optimisé pour la conversion.",
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
};

function row(overrides: Partial<RealisationRow> = {}): RealisationRow {
  return { ...baseRow, ...overrides };
}

describe("extractRealisation", () => {
  it("rejette les brouillons", async () => {
    expect(await extractRealisation(row({ status: "draft" }))).toBeNull();
    expect(await extractRealisation(row({ status: "archived" }))).toBeNull();
  });

  it("rejette le contenu trop court", async () => {
    const short = row({ description_md: "# Trop court" });
    expect(await extractRealisation(short)).toBeNull();
  });

  it("rejette le slug vide", async () => {
    expect(await extractRealisation(row({ slug: "" }))).toBeNull();
    expect(await extractRealisation(row({ slug: "   " }))).toBeNull();
  });

  it("génère une identité valide avec le bon slug et la bonne URL", async () => {
    const doc = await extractRealisation(row());

    expect(doc).not.toBeNull();
    expect(doc!.identity).toMatchObject({
      sourceType: "realisation",
      slug: "site-vitrine-acme",
      locale: "fr",
    });
    expect(doc!.identity.version).toMatch(/^[0-9a-f]{12}$/);
    expect(doc!.sourceUrl).toBe("https://webxia.fr/work/site-vitrine-acme");
    expect(doc!.sourcePath).toBe("realisations:site-vitrine-acme");
    expect(doc!.title).toBe("Site vitrine Acme");
    expect(doc!.content).toContain("# Site vitrine Acme");
    expect(doc!.content).toContain(baseRow.description_md);
  });

  it("place technologies et client_name dans metadata", async () => {
    const doc = await extractRealisation(row());

    expect(doc!.metadata).toMatchObject({
      technologies: ["React", "Tailwind"],
      clientName: "Acme Corp",
      featured: true,
    });
  });

  it("exclut content_html, gallery_images, project_url, github_url du metadata", async () => {
    const doc = await extractRealisation(row());

    expect(doc!.metadata).not.toHaveProperty("content_html");
    expect(doc!.metadata).not.toHaveProperty("gallery_images");
    expect(doc!.metadata).not.toHaveProperty("project_url");
    expect(doc!.metadata).not.toHaveProperty("github_url");
  });
});
