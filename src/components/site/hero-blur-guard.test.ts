/**
 * Garde-fou anti-régression : empêche la réintroduction de
 * filter: blur() coûteux sur les blobs du hero.
 *
 * Contexte : bug Safari iOS résolu en LOT 45.
 * Un filter: blur(120px) sur des surfaces 640x640 et 360x360
 * saturait le GPU/raster WebKit iOS, provoquant checkerboarding,
 * sections vides, animations figées et boutons non cliquables.
 *
 * Règle : au-delà de 20px, utiliser un radial-gradient plutôt
 * qu'un filter: blur.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const heroPath = path.resolve(process.cwd(), "src/components/site/hero.tsx");
const cssPath = path.resolve(process.cwd(), "src/styles.css");

const heroSource = readFileSync(heroPath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

/**
 * Extraction de bloc CSS volontairement basique : repère
 * `selector {` puis compte les accolades. Devra être adapté si le
 * CSS devient fortement imbriqué (règles imbriquées, @media dans
 * @media, etc.).
 */
function extractCssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    return "";
  }
  const open = css.indexOf("{", start);
  if (open === -1) {
    return "";
  }
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const char = css[i];
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return css.slice(start, i + 1);
      }
    }
  }
  return "";
}

describe("Hero blobs — garde-fou anti-régression filter:blur", () => {
  it("A — les blobs hero utilisent les classes dédiées", () => {
    expect(heroSource).toMatch(/hero-blob-brand/);
    expect(heroSource).toMatch(/hero-blob-accent/);
  });

  it("B — aucun blur Tailwind arbitraire > 20px dans hero.tsx", () => {
    // Garde-fou volontairement large : aucun blur Tailwind arbitraire
    // supérieur à 20px dans hero.tsx. Si un besoin légitime apparaît,
    // utiliser un radial-gradient plutôt qu'un filter: blur coûteux.
    const blurMatches = [...heroSource.matchAll(/blur-\[(\d+)px\]/g)];

    for (const match of blurMatches) {
      const px = Number.parseInt(match[1], 10);
      expect(px).toBeLessThanOrEqual(20);
    }
  });

  it("C — interdit les classes blur élevées Tailwind", () => {
    expect(heroSource).not.toMatch(/\bblur-(?:xl|2xl|3xl)\b/);
  });

  it("D — interdit un filter blur inline dans hero.tsx", () => {
    expect(heroSource).not.toMatch(/filter:\s*["']?blur\(/i);
  });

  it("E — classes CSS des blobs en radial-gradient, sans filter: blur", () => {
    const heroBlobBrand = extractCssBlock(cssSource, ".hero-blob-brand");
    const heroBlobAccent = extractCssBlock(cssSource, ".hero-blob-accent");

    expect(heroBlobBrand).not.toBe("");
    expect(heroBlobBrand).toContain("radial-gradient");
    expect(heroBlobBrand).not.toMatch(/filter:\s*blur/i);

    expect(heroBlobAccent).not.toBe("");
    expect(heroBlobAccent).toContain("radial-gradient");
    expect(heroBlobAccent).not.toMatch(/filter:\s*blur/i);
  });

  it("F — aucun backdrop-filter blur dans les blobs", () => {
    const heroBlobBrand = extractCssBlock(cssSource, ".hero-blob-brand");
    const heroBlobAccent = extractCssBlock(cssSource, ".hero-blob-accent");

    expect(heroBlobBrand).not.toMatch(/backdrop-filter:\s*blur/i);
    expect(heroBlobAccent).not.toMatch(/backdrop-filter:\s*blur/i);
  });
});
