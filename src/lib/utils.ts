import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const c of cookieHeader.split(";")) {
    const [name, ...rest] = c.trim().split("=");
    cookies[name] = rest.join("=");
  }
  return cookies;
}

export function getAuthCookieName(cookieHeader: string | null): string | null {
  const cookies = parseCookies(cookieHeader);
  return Object.keys(cookies).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token")) ?? null;
}

/**
 * Noms des cookies d'auth Supabase, en gérant le chunking SSR
 * (`sb-xxx-auth-token`, `sb-xxx-auth-token.0`, `sb-xxx-auth-token.1`, ...).
 */
export function getAuthCookieNames(cookieHeader: string | null): string[] {
  const cookies = parseCookies(cookieHeader);
  const base = getAuthCookieName(cookieHeader);
  if (!base) return [];
  const chunked = Object.keys(cookies)
    .filter((k) => k.startsWith(`${base}.`))
    .sort((a, b) => {
      const na = Number(a.slice(base.length + 1));
      const nb = Number(b.slice(base.length + 1));
      return na - nb;
    });
  // Si des chunks existent, ils ont priorité sur le cookie de base.
  return chunked.length > 0 ? chunked : [base];
}

const SUPABASE_B64_PREFIX = "base64-";

/**
 * Décode une valeur de cookie d'auth Supabase (déjà jointe) vers son JSON.
 * @supabase/ssr écrit par défaut en `base64url` ("base64-" + base64url(JSON),
 * chunké si besoin) ; les anciennes valeurs "raw" restent du JSON brut.
 * Les deux formes sont acceptées. Retourne null si indéchiffrable
 * (chunks partiels ou corrompus → traités comme absents, comme le SDK).
 * N'utilise que des API universelles (pas de Buffer : ce module est partagé).
 */
function decodeAuthCookieValue(joined: string): string | null {
  let text: string;
  try {
    text = decodeURIComponent(joined);
  } catch {
    return null;
  }
  if (!text.startsWith(SUPABASE_B64_PREFIX)) return text;
  try {
    const base64 = text.slice(SUPABASE_B64_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function extractAccessToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  const names = getAuthCookieNames(cookieHeader);
  if (names.length === 0) return null;

  const cookies = parseCookies(cookieHeader);
  try {
    const joined = names.map((n) => cookies[n] ?? "").join("");
    const decoded = decodeAuthCookieValue(joined);
    if (!decoded) return null;
    const parsed: unknown = JSON.parse(decoded);
    if (typeof parsed !== "object" || parsed === null) return null;
    const token = (parsed as { access_token?: unknown }).access_token;
    return typeof token === "string" ? token : null;
  } catch {
    return null;
  }
}

export function sanitizeIlike(input: string): string {
  return input.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Terme de recherche sûr pour les filtres PostgREST `.or(...)`.
 * Supprime les caractères réservés de la syntaxe (`,():"\`) qui cassaient
 * la requête, échappe les wildcards LIKE et limite la longueur.
 * Retourne "" si rien d'exploitable (l'appelant saute alors le filtre).
 */
export function sanitizeOrSearchTerm(input: string): string {
  const trimmed = input.trim().slice(0, 100);
  if (!trimmed) return "";
  // Retire les caractères réservés PostgREST + non-imprimables, collapse les espaces.
  const withoutReserved = trimmed
    .replace(/[,()":\\]/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutReserved) return "";
  return sanitizeIlike(withoutReserved);
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getPaginationParams(params: PaginationParams = {}): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginatedResponse<T>(
  data: T[] | null,
  count: number | null,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export function prepareSlugAndPublish(data: { slug?: string; title: string; status?: string }): {
  slug: string;
  publishedAt: string | null;
} {
  const slug = data.slug || slugify(data.title);
  const now = new Date().toISOString();
  const publishedAt = data.status === "published" ? now : null;
  return { slug, publishedAt };
}
