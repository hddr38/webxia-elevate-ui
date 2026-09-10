import type { Article } from "@/types/database";

const DEFAULT_GRADIENTS = [
  "linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #3b82f6 100%)",
  "linear-gradient(135deg, #1a103d 0%, #4c1d95 50%, #a855f7 100%)",
  "linear-gradient(135deg, #1a1a1a 0%, #3a2a1a 50%, #d4a574 100%)",
  "linear-gradient(135deg, #052e2b 0%, #064e3b 50%, #10b981 100%)",
  "linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #f59e0b 100%)",
  "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #6366f1 100%)",
];

export interface DisplayArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readingMinutes: number;
  author: string;
  cover: string;
  content: string[];
}

function hashToIndex(id: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

export function articleToDisplay(db: Article): DisplayArticle {
  return {
    slug: db.slug,
    title: db.title,
    excerpt: db.excerpt ?? "",
    category: db.category?.[0] ?? "article",
    date: db.published_at ?? db.created_at,
    readingMinutes: db.reading_minutes ?? 5,
    author: "WebXIA",
    cover: db.cover_image_url
      ? `url(${db.cover_image_url})`
      : DEFAULT_GRADIENTS[hashToIndex(db.id, DEFAULT_GRADIENTS.length)],
    content: (db.content_md ?? "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
  };
}
