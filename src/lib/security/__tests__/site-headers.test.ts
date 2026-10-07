import { describe, it, expect } from "vitest";
import {
  applySiteSecurityHeaders,
  buildSiteCsp,
  ensureServerFnProtocolHeader,
  hardenMiddlewareResult,
  writeSiteHeaders,
} from "../site-headers";

describe("buildSiteCsp", () => {
  it("allows Google Fonts, Supabase and blocks framing", () => {
    const csp = buildSiteCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("localhost");
  });

  it("allows the Cal.com booking embed (script, connect, frame)", () => {
    const csp = buildSiteCsp();
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cal.com https://*.cal.com",
    );
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).toContain("https://cal.com https://*.cal.com");
    expect(csp).toContain("frame-src https://cal.com https://*.cal.com");
    // Le reste du périmètre reste fermé.
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("https://evil.example");
  });

  it("adds dev-only connect sources in dev", () => {
    expect(buildSiteCsp({ dev: true })).toContain("ws://localhost:*");
    expect(buildSiteCsp({ dev: true })).toContain("http://127.0.0.1:*");
    expect(buildSiteCsp()).not.toContain("ws://localhost:*");
  });
});

describe("writeSiteHeaders", () => {
  it("sets the site-wide security headers", () => {
    const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
    writeSiteHeaders(headers);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("never overwrites an existing CSP (chat responses keep theirs)", () => {
    const headers = new Headers({ "Content-Security-Policy": "default-src 'none'" });
    writeSiteHeaders(headers);
    expect(headers.get("Content-Security-Policy")).toBe("default-src 'none'");
  });
});

describe("applySiteSecurityHeaders", () => {
  it("preserves status, body and custom headers while hardening", async () => {
    const original = new Response("<html></html>", {
      status: 201,
      headers: { "x-custom": "1" },
    });
    const hardened = applySiteSecurityHeaders(original);
    expect(hardened.status).toBe(201);
    expect(hardened.headers.get("x-custom")).toBe("1");
    expect(hardened.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(hardened.text()).resolves.toBe("<html></html>");
  });
});

describe("ensureServerFnProtocolHeader", () => {
  it("forges x-tsr-serverfn on /_serverFn/listLeads without the header (D2 revision)", () => {
    const request = new Request("http://localhost:4173/_serverFn/listLeads?payload=%7B%7D");
    ensureServerFnProtocolHeader(request);
    expect(request.headers.get("x-tsr-serverFn")).toBe("true");
  });

  it("leaves an existing x-tsr-serverfn=true untouched", () => {
    const request = new Request("http://localhost:4173/_serverFn/listLeads?payload=%7B%7D");
    request.headers.set("x-tsr-serverfn", "true");
    ensureServerFnProtocolHeader(request);
    expect(request.headers.get("x-tsr-serverfn")).toBe("true");
    expect(
      [...request.headers.keys()].filter((k) => k.toLowerCase() === "x-tsr-serverfn"),
    ).toHaveLength(1);
  });

  it("does NOT forge the header outside /_serverFn/ (e.g. /admin)", () => {
    const request = new Request("http://localhost:4173/admin/leads");
    ensureServerFnProtocolHeader(request);
    expect(request.headers.get("x-tsr-serverfn")).toBeNull();
  });

  it("forges the header on /_serverFn/deleteLead without it", () => {
    const request = new Request("http://localhost:4173/_serverFn/deleteLead");
    ensureServerFnProtocolHeader(request);
    expect(request.headers.get("x-tsr-serverfn")).toBe("true");
  });
});

describe("hardenMiddlewareResult", () => {
  it("hardens a bare Response (site headers written, status preserved)", () => {
    const original = new Response("no-store", { status: 201 });
    const hardened = hardenMiddlewareResult(original);
    expect(hardened).toBeInstanceOf(Response);
    expect((hardened as Response).status).toBe(201);
    expect((hardened as Response).headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect((hardened as Response).headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("hardens { response: Response } in place and returns the same object reference", () => {
    const response = new Response("ok", { status: 200 });
    const result = { response, context: { user: null } };

    const out = hardenMiddlewareResult(result);

    expect(out).toBe(result);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.status).toBe(200);
  });

  it("returns {} unchanged without crashing when .response is missing (LOT 39 regression)", () => {
    const result = { context: {}, result: { total: 0 } };

    const out = hardenMiddlewareResult(result);

    expect(out).toBe(result);
  });

  it("returns { response: { headers: undefined } } unchanged without crashing", () => {
    const result = { response: { headers: undefined } };

    const out = hardenMiddlewareResult(result);

    expect(out).toBe(result);
  });

  it("returns null, undefined and primitives unchanged", () => {
    expect(hardenMiddlewareResult(null)).toBe(null);
    expect(hardenMiddlewareResult(undefined)).toBe(undefined);
    expect(hardenMiddlewareResult(0)).toBe(0);
    expect(hardenMiddlewareResult("plain")).toBe("plain");
  });

  it("thrown values: a Response is hardened (start.ts catch contract), an Error passes through untouched", () => {
    const thrownResponse = new Response("Unauthorized", { status: 401 });
    const hardened = hardenMiddlewareResult(thrownResponse) as Response;
    expect(hardened).toBeInstanceOf(Response);
    expect(hardened.status).toBe(401);
    expect(hardened.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(hardened.headers.get("Cache-Control")).toBe(null);

    const boom = new Error("boom");
    expect(hardenMiddlewareResult(boom)).toBe(boom);
  });
});
