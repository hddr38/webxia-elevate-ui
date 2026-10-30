import type { ArticleRow } from "./types";
import { computeContentVersion, type MemorySourceIdentity } from "../../contracts/source-key";
import { SITE_BASE_URL } from "@/lib/constants";
import { MIN_CONTENT_CHARS } from "./types";

/**
 * Extrait un document RAG à partir d'une ligne `articles`.
 *
 * Règles :
 * - statut `published` uniquement (sinon `null`) ;
 * - `content_md` d'au moins 200 caractères (sinon `null`) ;
 * - `slug` non vide (sinon `null`) ;
 * - identité `article:{slug}:fr:{version}` où `version` est l'empreinte du
 *   contenu markdown ;
 * - contenu = chapeau (titre) + `content_md` ;
 * - URL publique = `${SITE_BASE_URL}/journal/{slug}` ;
 * - le slug est issu de la base (déjà slugifié par l'admin), pas recalculé.
 *
 * Fonction pure : aucun appel DB, aucun effet de bord.
 */
export async function extractArticle(
  row: ArticleRow,
): Promise<import("./types").ExtractedDocument | null> {
  if (row.status !== "published") return null;
  if (!row.slug || row.slug.trim().length === 0) return null;
  if (!row.content_md || row.content_md.length < MIN_CONTENT_CHARS) return null;

  const version = await computeContentVersion(row.content_md);
  const identity: MemorySourceIdentity = {
    sourceType: "article",
    slug: row.slug,
    locale: "fr",
    version,
  };
  const title = row.title;
  const content = `# ${title}\n\n${row.content_md}`;
  const sourceUrl = `${SITE_BASE_URL}/journal/${row.slug}`;
  const sourcePath = `articles:${row.slug}`;

  return {
    identity,
    title,
    content,
    sourceUrl,
    sourcePath,
    metadata: {
      slug: row.slug,
      tags: row.tags ?? [],
      category: row.category ?? [],
      excerpt: row.excerpt,
      readingMinutes: row.reading_minutes,
      publishedAt: row.published_at,
      authorId: row.author_id,
    },
  };
}
