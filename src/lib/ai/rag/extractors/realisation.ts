import type { RealisationRow } from "./types";
import { computeContentVersion, type MemorySourceIdentity } from "../../contracts/source-key";
import { SITE_BASE_URL } from "@/lib/constants";
import { MIN_CONTENT_CHARS } from "./types";

/**
 * Extrait un document RAG à partir d'une ligne `realisations`.
 *
 * Règles :
 * - statut `published` uniquement (sinon `null`) ;
 * - `description_md` d'au moins 200 caractères (sinon `null`) ;
 * - `slug` non vide (sinon `null`) ;
 * - identité `realisation:{slug}:fr:{version}` où `version` est l'empreinte
 *   du contenu markdown ;
 * - contenu = chapeau (`short_description`) + `description_md` ;
 * - URL publique = `${SITE_BASE_URL}/work/{slug}` ;
 * - métadonnées sémantiques : `technologies`, `client_name`, `featured`.
 *
 * Fonction pure : aucun appel DB, aucun effet de bord.
 */
export async function extractRealisation(
  row: RealisationRow,
): Promise<import("./types").ExtractedDocument | null> {
  if (row.status !== "published") return null;
  if (!row.slug || row.slug.trim().length === 0) return null;
  if (!row.description_md || row.description_md.length < MIN_CONTENT_CHARS) return null;

  const version = await computeContentVersion(row.description_md);
  const identity: MemorySourceIdentity = {
    sourceType: "realisation",
    slug: row.slug,
    locale: "fr",
    version,
  };
  const title = row.title;
  const chapeau = row.short_description ? `> ${row.short_description}\n\n` : "";
  const content = `# ${title}\n\n${chapeau}${row.description_md}`;
  const sourceUrl = `${SITE_BASE_URL}/work/${row.slug}`;
  const sourcePath = `realisations:${row.slug}`;

  return {
    identity,
    title,
    content,
    sourceUrl,
    sourcePath,
    metadata: {
      slug: row.slug,
      technologies: row.technologies ?? [],
      clientName: row.client_name,
      featured: row.featured ?? false,
      category: row.category ?? [],
      shortDescription: row.short_description,
    },
  };
}
