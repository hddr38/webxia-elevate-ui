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

export function extractAccessToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  const authCookieName = getAuthCookieName(cookieHeader);
  if (!authCookieName) return null;

  const cookies = parseCookies(cookieHeader);
  try {
    const parsed = JSON.parse(decodeURIComponent(cookies[authCookieName]));
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

export function sanitizeIlike(input: string): string {
  return input.replace(/[%_]/g, (match) => `\\${match}`);
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

export function getPaginationParams(params: PaginationParams = {}): { page: number; limit: number; offset: number } {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginatedResponse<T>(data: T[] | null, count: number | null, page: number, limit: number): PaginatedResult<T> {
  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export function prepareSlugAndPublish(data: { slug?: string; title: string; status?: string }): { slug: string; publishedAt: string | null } {
  const slug = data.slug || slugify(data.title);
  const now = new Date().toISOString();
  const publishedAt = data.status === "published" ? now : null;
  return { slug, publishedAt };
}


