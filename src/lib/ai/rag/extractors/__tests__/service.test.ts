import { describe, it, expect } from "vitest";
import type { ServiceSectionData } from "@/content/services-fr";
import { extractServices } from "../service";

const baseSection: ServiceSectionData = {
  eyebrow: "01 . SITES INTERNET",
  title: "Transformez votre présence en ligne",
  subtitle: "Votre site web est votre premier contact.",
  cards: [
    {
      icon: "Globe",
      title: "Site Vitrine",
      description: "Un site professionnel qui inspire confiance.",
      bullets: ["Design moderne", "Responsive", "SEO optimisé"],
      tag: "01",
    },
  ],
};

function section(overrides: Partial<ServiceSectionData>): ServiceSectionData {
  return { ...baseSection, ...overrides };
}

const frSections: ServiceSectionData[] = [
  section({ eyebrow: "01 . SITES INTERNET", title: "Sites Internet FR" }),
  section({ eyebrow: "02 . APPLICATIONS & DÉVELOPPEMENT", title: "Applications FR" }),
  section({ eyebrow: "03 . IMAGE DE MARQUE", title: "Marque FR" }),
  section({ eyebrow: "04 . VISIBILITÉ & ACQUISITION", title: "Visibilité FR" }),
  section({ eyebrow: "05 . IA & AUTOMATISATION", title: "IA FR" }),
  section({ eyebrow: "06 . CONSEIL & CROISSANCE", title: "Conseil FR" }),
  section({ eyebrow: "07 . MAINTENANCE & HÉBERGEMENT", title: "Maintenance FR" }),
];

const enSections: ServiceSectionData[] = [
  section({ eyebrow: "01 . WEBSITES", title: "Websites EN" }),
  section({ eyebrow: "02 . APPLICATIONS & DEVELOPMENT", title: "Applications EN" }),
  section({ eyebrow: "03 . BRAND IDENTITY", title: "Brand EN" }),
  section({ eyebrow: "04 . VISIBILITY & ACQUISITION", title: "Visibility EN" }),
  section({ eyebrow: "05 . AI & AUTOMATION", title: "AI EN" }),
  section({ eyebrow: "06 . CONSULTING & GROWTH", title: "Consulting EN" }),
  section({ eyebrow: "07 . MAINTENANCE & HOSTING", title: "Maintenance EN" }),
];

describe("extractServices", () => {
  it("exige la parité FR/EN", async () => {
    await expect(extractServices(frSections, enSections.slice(0, 6))).rejects.toThrow(
      /Parité FR\/EN/,
    );
  });

  it("retourne 14 documents (7 FR + 7 EN)", async () => {
    const docs = await extractServices(frSections, enSections);

    expect(docs).toHaveLength(14);
    expect(docs.filter((d) => d.identity.locale === "fr")).toHaveLength(7);
    expect(docs.filter((d) => d.identity.locale === "en")).toHaveLength(7);
  });

  it("génère des identités service:section-NN:locale:version", async () => {
    const docs = await extractServices(frSections, enSections);

    const fr01 = docs.find((d) => d.identity.locale === "fr" && d.identity.slug === "section-01");
    expect(fr01).toBeDefined();
    expect(fr01!.identity.sourceType).toBe("service");
    expect(fr01!.identity.locale).toBe("fr");
    expect(fr01!.identity.version).toMatch(/^[0-9a-f]{12}$/);

    const en01 = docs.find((d) => d.identity.locale === "en" && d.identity.slug === "section-01");
    expect(en01).toBeDefined();
    expect(en01!.identity.locale).toBe("en");
    // Même slug, contenu texte différent → version différente
    expect(en01!.identity.version).not.toBe(fr01!.identity.version);
  });

  it("construit les bonnes URLs d'ancre par index de section", async () => {
    const docs = await extractServices(frSections, enSections);

    const frDocs = docs
      .filter((d) => d.identity.locale === "fr")
      .sort((a, b) => a.identity.slug.localeCompare(b.identity.slug));

    expect(frDocs[0].sourceUrl).toBe("https://webxia.fr/services#services");
    expect(frDocs[1].sourceUrl).toBe("https://webxia.fr/services#section-1");
    expect(frDocs[2].sourceUrl).toBe("https://webxia.fr/services#section-2");
    expect(frDocs[6].sourceUrl).toBe("https://webxia.fr/services#section-6");
  });

  it("assemble le contenu structuré avec titre, sous-titre et cartes", async () => {
    const docs = await extractServices(frSections, enSections);

    const first = docs.find((d) => d.identity.locale === "fr" && d.identity.slug === "section-01");
    expect(first!.content).toContain("01 . SITES INTERNET");
    expect(first!.content).toContain("# Sites Internet FR");
    expect(first!.content).toContain("Votre site web est votre premier contact.");
    expect(first!.content).toContain("## Site Vitrine");
    expect(first!.content).toContain("Un site professionnel qui inspire confiance.");
    expect(first!.content).toContain("- Design moderne");
  });

  it("ne contient pas de champs exclus dans metadata", async () => {
    const docs = await extractServices(frSections, enSections);

    for (const doc of docs) {
      expect(doc.metadata).not.toHaveProperty("content_html");
      expect(doc.metadata).not.toHaveProperty("gallery_images");
      expect(doc.metadata).not.toHaveProperty("project_url");
      expect(doc.metadata).not.toHaveProperty("github_url");
    }
  });

  it("lève sur une eyebrow invalide", async () => {
    const bad = section({ eyebrow: "Mauvais format" });
    await expect(extractServices([bad], [bad])).rejects.toThrow(/Eyebrow de service/);
  });
});
