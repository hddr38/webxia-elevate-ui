import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { getSessionUser } from "./lib/auth/session";
import { extractAccessToken } from "./lib/utils";
import { applySiteSecurityHeaders, writeSiteHeaders } from "./lib/security/site-headers";

// Track application start time for uptime
declare global {
  var __webi_start_time: number;
}
globalThis.__webi_start_time = Date.now();

const siteHeaderOptions = { dev: import.meta.env.DEV };

function hardenResponse(response: Response): Response {
  try {
    writeSiteHeaders(response.headers, siteHeaderOptions);
    return response;
  } catch {
    // Immutable headers (redirect()) — rebuild with the same body/status.
    return applySiteSecurityHeaders(response, siteHeaderOptions);
  }
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Site-wide security headers on every response (HTML documents included).
// Runs outermost so redirects, 403s and the 500 error page are covered too.
const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  try {
    const result = await next();
    if (result instanceof Response) {
      return hardenResponse(result);
    }
    try {
      writeSiteHeaders(result.response.headers, siteHeaderOptions);
    } catch {
      result.response = applySiteSecurityHeaders(result.response, siteHeaderOptions);
    }
    return result;
  } catch (error) {
    if (error instanceof Response) {
      throw hardenResponse(error);
    }
    throw error;
  }
});

// Server-side /admin guard. The route-level adminMiddleware never runs for
// document requests (routeTree nests /admin/* as root children, so the
// /admin/_layout server middleware is skipped) — this guard lives in the
// start-level request pipeline and is therefore always executed.
const adminPathGuardMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, handlerType, next }) => {
    if (handlerType !== "router") return next();
    if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return next();

    // Fails closed: a user is an admin only when admin_users says so.
    const user = await getSessionUser(request);
    if (user) return next();

    if (extractAccessToken(request)) {
      // Authenticated but not an admin_users row.
      return new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const url = new URL(request.url);
    const redirect = encodeURIComponent(url.pathname + url.search);
    return new Response(null, {
      status: 302,
      headers: { Location: `/auth/login?redirect=${redirect}`, "Cache-Control": "no-store" },
    });
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, adminPathGuardMiddleware, errorMiddleware],
}));
