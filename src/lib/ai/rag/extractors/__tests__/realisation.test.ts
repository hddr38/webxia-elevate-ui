import { describe, it, expect } from "vitest";
import type { RealisationRow } from "../types";
import { extractRealisation } from "../realisation";
import { MIN_CONTENT_CHARS } from "../types";
import { buildSourceKey, computeContentVersion } from "../../../contracts/source-key";

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

  it("détecte la limite MIN_CONTENT_CHARS : exactement 200 accepté, 199 rejeté", async () => {
    const atLimit = row({ description_md: "x".repeat(MIN_CONTENT_CHARS) });
    expect(await extractRealisation(atLimit)).not.toBeNull();

    const belowLimit = row({ description_md: "x".repeat(MIN_CONTENT_CHARS - 1) });
    expect(await extractRealisation(belowLimit)).toBeNull();
  });

  it("la version change quand le contenu change, et reste stable sinon", async () => {
    const base = await extractRealisation(row());
    const same = await extractRealisation(row());
    const edited = await extractRealisation(
      row({ description_md: `${baseRow.description_md} Édition.` }),
    );

    expect(same!.identity.version).toBe(base!.identity.version);
    expect(edited!.identity.version).not.toBe(base!.identity.version);

    // La version est l'empreinte de description_md seul (pas du chapeau ni du titre).
    expect(base!.identity.version).toBe(await computeContentVersion(baseRow.description_md));
  });

  it("construit une source_key valide via buildSourceKey", async () => {
    const doc = await extractRealisation(row());

    expect(buildSourceKey(doc!.identity)).toBe(
      `realisation:site-vitrine-acme:fr:${doc!.identity.version}`,
    );
  });

  it("transporte shortDescription et category dans metadata", async () => {
    const doc = await extractRealisation(row());

    expect(doc!.metadata).toMatchObject({
      shortDescription: baseRow.short_description,
      category: ["web"],
    });
  });

  it("fonction pure : deux appels produisent le même document (déterminisme)", async () => {
    const a = await extractRealisation(row());
    const b = await extractRealisation(row());

    expect(a).toEqual(b);
  });
});
