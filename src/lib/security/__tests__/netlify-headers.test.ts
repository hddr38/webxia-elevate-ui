import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * LOT 39 P4 (QW-8) — integrite de netlify.toml.
 * La regle /assets/* immutable est STRICTEMENT additive : aucun autre path
 * (/, /fonts/*) ni aucun header de securite (CSP, HSTS, ...) ne doit y
 * apparaitre — source unique = src/lib/security/site-headers.ts (LOT 9).
 */
const TOML_PATH = join(process.cwd(), "netlify.toml");

function readToml(): string {
  return readFileSync(TOML_PATH, "utf-8");
}

describe("netlify.toml headers (LOT 39 P4 — QW-8)", () => {
  it("definit /assets/* en immutable, valeur exacte", () => {
    const toml = readToml();
    expect(toml).toContain('for = "/assets/*"');
    expect(toml).toContain('cache-control = "public, max-age=31536000, immutable"');
  });

  it("ne definit qu'UN seul bloc [[headers]] (pas d'elargissement)", () => {
    const toml = readToml();
    const blocks = toml.match(/\[\[headers\]\]/g) ?? [];
    expect(blocks).toHaveLength(1);
    // La seule regle `for` des headers vise /assets/* (ni /, ni /*,
    // ni /fonts/* — le commentaire LOT 39 cite /fonts/*, d'ou le filtre
    // sur les lignes `for =` plutot que sur le texte brut).
    const forRules = [...toml.matchAll(/^\s*for\s*=\s*"([^"]+)"\s*$/gm)].map((m) => m[1]);
    expect(forRules).toEqual(["/assets/*"]);
  });

  it("ne definit aucun header de securite (source unique site-headers.ts)", () => {
    const toml = readToml().toLowerCase();
    for (const h of [
      "content-security-policy",
      "strict-transport-security",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy",
      "permissions-policy",
      "cross-origin",
    ]) {
      expect(toml).not.toContain(h);
    }
  });

  it("conserve le build et le redirect /api/* intacts", () => {
    const toml = readToml();
    expect(toml).toContain('command = "npm run build"');
    expect(toml).toContain('publish = "dist/client"');
    expect(toml).toContain('from = "/api/*"');
    expect(toml).toContain("status = 200");
  });
});
