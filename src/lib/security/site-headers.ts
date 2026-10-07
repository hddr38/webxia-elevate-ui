export interface SiteHeaderOptions {
  /** Allow dev-only connect sources (Vite HMR websockets). */
  dev?: boolean;
}

const DEV_CONNECT_SOURCES = [
  "http://localhost:*",
  "ws://localhost:*",
  "http://127.0.0.1:*",
  "ws://127.0.0.1:*",
];

// Cal.com (embed booking sur /contact) : le script externe, ses fetchs et
// l'iframe de booking. Étendu à *.cal.com car Cal bascule entre app.cal.com
// et cal.com (redirections / anciens flux). Tout reste sous contrôle Cal.
const CAL_SOURCES = ["https://cal.com", "https://*.cal.com"];

export function buildSiteCsp({ dev = false }: SiteHeaderOptions = {}): string {
  const connectSrc = ["'self'", "https://*.supabase.co", "wss://*.supabase.co", ...CAL_SOURCES];
  if (dev) connectSrc.push(...DEV_CONNECT_SOURCES);

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CAL_SOURCES.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${CAL_SOURCES.join(" ")}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const SITE_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function writeSiteHeaders(headers: Headers, options: SiteHeaderOptions = {}): void {
  for (const [name, value] of Object.entries(SITE_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (!headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", buildSiteCsp(options));
  }
}

export function applySiteSecurityHeaders(
  response: Response,
  options: SiteHeaderOptions = {},
): Response {
  const headers = new Headers(response.headers);
  writeSiteHeaders(headers, options);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Forge le header protocol TSS x-tsr-serverfn sur les requêtes /_serverFn/*
 * (LOT 39, D2 révisé). Sans ce header, TSS renvoie le payload brut qui est
 * perdu dans la chaîne middleware → ERR_NO_RESPONSE → 500 HTML. Le client TSS
 * l'envoie toujours ; on normalise ici les appels externes. Auth (401/403) et
 * CSRF restent en amont et sont indépendants de ce header.
 */
export function ensureServerFnProtocolHeader(request: Request): void {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/_serverFn/") && request.headers.get("x-tsr-serverfn") !== "true") {
    request.headers.set("x-tsr-serverfn", "true");
  }
}

/**
 * Durcit le résultat d'une request middleware sans jamais crasher (LOT 39).
 * - Response → headers site (rebuild si les headers sont immuables).
 * - Objet { response } → headers écrits in place, même référence retournée.
 * - result.response absent / illisible → retour inchangé (TSS sérialise lui-même).
 * - null, undefined, primitives, Error → retournés tels quels, jamais transformés.
 */
export function hardenMiddlewareResult<T>(result: T, options: SiteHeaderOptions = {}): T {
  if (result instanceof Response) {
    try {
      writeSiteHeaders(result.headers, options);
      return result;
    } catch {
      return applySiteSecurityHeaders(result, options) as T;
    }
  }

  if (result === null || typeof result !== "object") {
    return result;
  }

  const target = result as { response?: unknown };
  const response = target.response;
  if (response === null || typeof response !== "object") {
    return result;
  }

  const headers = (response as { headers?: unknown }).headers;
  if (!(headers instanceof Headers)) {
    return result;
  }

  try {
    writeSiteHeaders(headers, options);
  } catch {
    try {
      target.response = applySiteSecurityHeaders(response as Response, options);
    } catch {
      return result;
    }
  }
  return result;
}
