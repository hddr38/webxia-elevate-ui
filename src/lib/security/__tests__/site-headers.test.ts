import { describe, it, expect } from "vitest";
import { applySiteSecurityHeaders, buildSiteCsp, writeSiteHeaders } from "../site-headers";

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
