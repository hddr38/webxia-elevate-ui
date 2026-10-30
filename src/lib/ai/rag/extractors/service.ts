import type { ServiceSectionData } from "@/content/services-fr";
import { computeContentVersion, type MemorySourceIdentity } from "../../contracts/source-key";
import { SITE_BASE_URL } from "@/lib/constants";
import type { ExtractedDocument } from "./types";

/**
 * Extrait le numéro de section à partir de l'eyebrow ("01 . SITES INTERNET").
 *
 * L'eyebrow est stable et commun aux fichiers FR/EN : il ne change pas quand
 * le titre marketing est retouché. Retourne `null` si le format est invalide.
 */
function sectionNumber(eyebrow: string): string | null {
  const match = eyebrow.match(/^(\d{1,2})\s*\./);
  if (!match) return null;
  return `section-${match[1].padStart(2, "0")}`;
}

/**
 * Assemble le contenu d'une section de services en un texte lisible et
 * structuré (titre, sous-titre, puis chaque carte avec description et bullets).
 */
function assembleServiceContent(section: ServiceSectionData): string {
  const lines: string[] = [];
  if (section.eyebrow) lines.push(section.eyebrow);
  lines.push(`# ${section.title}`);
  if (section.subtitle) lines.push(section.subtitle);
  for (const card of section.cards ?? []) {
    lines.push(`## ${card.title}`);
    if (card.description) lines.push(card.description);
    for (const bullet of card.bullets ?? []) {
      lines.push(`- ${bullet}`);
    }
  }
  return lines.join("\n");
}

/**
 * Extrait les documents RAG des sections de services (FR et EN).
 *
 * Retourne un document par section, par locale (14 documents au total avec
 * les 7 sections actuelles × 2 locales).
 *
 * Règles :
 * - `slug` dérivé de l'eyebrow (`section-01`…`section-07`) — jamais du titre,
 *   pour que la clé soit stable sous retouche marketing ;
 * - `locale` = `fr` pour le fichier FR, `en` pour le fichier EN ;
 * - `version` = empreinte du contenu assemblé ;
 * - URL publique : section 0 → `${SITE_BASE_URL}/services#services`,
 *   sections suivantes → `${SITE_BASE_URL}/services#section-{index}` ;
 * - parité FR/EN exigée : les deux fichiers doivent contenir le même nombre
 *   de sections.
 *
 * Fonction pure : aucun appel DB, aucun effet de bord.
 */
export async function extractServices(
  frData: ServiceSectionData[],
  enData: ServiceSectionData[],
): Promise<ExtractedDocument[]> {
  if (frData.length !== enData.length) {
    throw new Error(
      `Parité FR/EN des sections de services rompue : ${frData.length} FR vs ${enData.length} EN`,
    );
  }

  const documents: ExtractedDocument[] = [];

  const buildLocale = async (
    data: ServiceSectionData[],
    locale: "fr" | "en",
  ): Promise<ExtractedDocument[]> => {
    const out: ExtractedDocument[] = [];
    for (const [index, section] of data.entries()) {
      const slug = sectionNumber(section.eyebrow);
      if (!slug) {
        throw new Error(
          `Eyebrow de service invalide (attendu "NN . LIBELLÉ") : "${section.eyebrow}"`,
        );
      }
      const content = assembleServiceContent(section);
      const version = await computeContentVersion(content);
      const identity: MemorySourceIdentity = {
        sourceType: "service",
        slug,
        locale,
        version,
      };
      const sourceUrl = `${
        index === 0
          ? `${SITE_BASE_URL}/services#services`
          : `${SITE_BASE_URL}/services#section-${index}`
      }`;
      const sourcePath = `services:${slug}:${locale}`;

      out.push({
        identity,
        title: section.title,
        content,
        sourceUrl,
        sourcePath,
        metadata: {
          eyebrow: section.eyebrow,
          subtitle: section.subtitle,
          cards: section.cards ?? [],
          engagements: section.engagements ?? [],
          sectionIndex: index,
        },
      });
    }
    return out;
  };

  documents.push(...(await buildLocale(frData, "fr")));
  documents.push(...(await buildLocale(enData, "en")));

  return documents;
}
