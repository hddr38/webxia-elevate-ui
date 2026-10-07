import { expect, test } from "@playwright/test";

/**
 * LOT 39 P4 (QW-8, bug B-7) — headers HTTP.
 *
 * Les regles Netlify (netlify.toml [[headers]]) ne s'appliquent QUE sur
 * Netlify (prod) : `vite preview` local ne les sert pas. D'ou 2 groupes :
 *  - "serveur" : invariants servis par la fonction serveur, verts en
 *    local comme en prod (gates GO #1).
 *  - "prod" : comportement CDN Netlify, SKIPPES en local, executes
 *    post-deploiement (P5) avec E2E_TARGET_URL=https://webxia-fr.netlify.app.
 */
const PROD = process.env.E2E_TARGET_URL;

test.describe("Headers serveur (local + prod)", () => {
  // Note : `vite preview` local ne sert AUCUN cache-control (ni sur / ni
  // sur /assets/*) — le comportement cache est 100 % CDN Netlify. Seuls les
  // headers de securite (middleware start.ts, identique local/prod) sont
  // verifies ici. Tout le reste (/, /assets/*, /fonts/*) est prod-gate (P5).
  test("GET / → headers de securite intacts (valeurs documentees P4)", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const h = response?.headers() ?? {};
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(h["strict-transport-security"]).toContain("max-age=31536000");
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("script-src 'self' 'unsafe-inline'");
  });
});

test.describe("Headers CDN Netlify (prod uniquement, P5)", () => {
  test.skip(!PROD, "requiert E2E_TARGET_URL (Netlify)");

  test("GET / → cache-control no-cache (inchange)", async ({ page }) => {
    const response = await page.goto(`${PROD}/`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toContain("no-cache");
  });

  test("GET /assets/<js-hashe> → immutable + max-age=31536000", async ({ page }) => {
    const home = await page.request.get(`${PROD}/`);
    expect(home.status()).toBe(200);
    const html = await home.text();
    const match = html.match(/\/assets\/index-[^"]+\.js/);
    expect(match).not.toBeNull();

    const asset = await page.request.get(`${PROD}${match![0]}`);
    expect(asset.status()).toBe(200);
    const cc = asset.headers()["cache-control"] ?? "";
    expect(cc).toContain("max-age=31536000");
    expect(cc).toContain("immutable");
  });

  test("GET /fonts/<woff2> → inchange (pas d'immutable, hors perimetre P4)", async ({ page }) => {
    const font = await page.request.get(`${PROD}/fonts/inter-latin.woff2`);
    expect(font.status()).toBe(200);
    expect(font.headers()["cache-control"] ?? "").not.toContain("immutable");
  });

  test("2e visite : 0 revalidation ETag sur /assets/* (bug B-7 corrige)", async ({ page }) => {
    // Navigation normale (pas reload) : avec max-age=0, le navigateur
    // revalide les entrees stales (If-None-Match) ; avec immutable frais,
    // il sert le cache sans aucune requete conditionnelle.
    await page.goto(`${PROD}/`);
    await page.waitForLoadState("load");
    await page.goto(`${PROD}/work`);
    await page.waitForLoadState("load");

    const conditional: string[] = [];
    page.on("request", (req) => {
      if (!req.url().includes("/assets/")) return;
      const headers = req.headers();
      if (headers["if-none-match"] || headers["if-modified-since"]) {
        conditional.push(req.url());
      }
    });
    await page.goto(`${PROD}/`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);
    expect(conditional).toEqual([]);
  });
});
