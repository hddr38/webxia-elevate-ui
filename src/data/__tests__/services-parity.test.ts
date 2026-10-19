/**
 * LOT "I18N PHASE 1" — garde-fou de parité FR/EN des sections services.
 *
 * services-fr.ts et services-en.ts sont deux sources parallèles qui
 * partagent le même type ServiceSectionData[]. Rien ne garantit leur
 * synchronisation : ce test bloque toute divergence structurelle
 * (nombre de sections, id de section = eyebrow, nombre de cartes,
 * nombre de bullets par carte).
 *
 * Il ne compare PAS les traductions texte par texte (hors périmètre),
 * uniquement la structure qui pilote le rendu de la page /services.
 */
import { describe, expect, it } from "vitest";
import { servicesEn } from "../services-en";
import { servicesFr } from "../services-fr";

const COMMON_LENGTH = Math.min(servicesFr.length, servicesEn.length);

/**
 * L'eyebrow est traduit ("01 . SITES INTERNET" vs "01 . WEBSITES") :
 * l'identifiant structurel de section est son préfixe numérique ("01").
 */
function sectionId(eyebrow: string): string {
  return eyebrow.split(".")[0]?.trim() ?? eyebrow;
}

describe("services FR/EN parity", () => {
  it("declares the same number of sections", () => {
    expect(
      servicesEn.length,
      `Section count mismatch: services-fr.ts has ${servicesFr.length} sections, services-en.ts has ${servicesEn.length}`,
    ).toBe(servicesFr.length);
  });

  it("every section has the same id (eyebrow number)", () => {
    for (let i = 0; i < COMMON_LENGTH; i++) {
      const fr = servicesFr[i];
      const en = servicesEn[i];
      if (!fr || !en) continue;
      expect(
        sectionId(en.eyebrow),
        `Section #${i + 1}: id mismatch — fr "${fr.eyebrow}" vs en "${en.eyebrow}"`,
      ).toBe(sectionId(fr.eyebrow));
    }
  });

  it("every section has the same number of cards", () => {
    for (let i = 0; i < COMMON_LENGTH; i++) {
      const fr = servicesFr[i];
      const en = servicesEn[i];
      if (!fr || !en) continue;
      const frCount = fr.cards?.length ?? 0;
      const enCount = en.cards?.length ?? 0;
      expect(
        enCount,
        `Section "${fr.eyebrow}" (#${i + 1}): card count mismatch — fr has ${frCount}, en has ${enCount}`,
      ).toBe(frCount);
    }
  });

  it("every card has the same number of bullets", () => {
    for (let i = 0; i < COMMON_LENGTH; i++) {
      const frSection = servicesFr[i];
      const enSection = servicesEn[i];
      if (!frSection || !enSection) continue;
      const frCards = frSection.cards ?? [];
      const enCards = enSection.cards ?? [];
      for (let c = 0; c < Math.min(frCards.length, enCards.length); c++) {
        const frCard = frCards[c];
        const enCard = enCards[c];
        if (!frCard || !enCard) continue;
        expect(
          enCard.bullets.length,
          `Section "${frSection.eyebrow}" → card "${frCard.title}" (#${c + 1}): bullet count mismatch — fr has ${frCard.bullets.length}, en has ${enCard.bullets.length}`,
        ).toBe(frCard.bullets.length);
      }
    }
  });
});
