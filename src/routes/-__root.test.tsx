import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { THEME_INIT_SCRIPT } from "./__root";

/**
 * LOT 39 P3 (QW-6) — le script pre-paint porte la logique de priorite du
 * theme (localStorage → matchMedia → defaut dark), coherente avec
 * ThemeProvider (theme-context.tsx, inchange). Le placement (avant la
 * stylesheet) est verifie E2E sur le HTML servi.
 */
describe("THEME_INIT_SCRIPT (LOT 39 P3 — QW-6)", () => {
  it("lit localStorage en priorite 1 (cle webxia-theme)", () => {
    expect(THEME_INIT_SCRIPT).toContain('localStorage.getItem("webxia-theme")');
  });

  it("replique le fallback matchMedia puis le defaut dark", () => {
    const ls = THEME_INIT_SCRIPT.indexOf("localStorage");
    const mm = THEME_INIT_SCRIPT.indexOf("prefers-color-scheme");
    expect(ls).toBeGreaterThanOrEqual(0);
    expect(mm).toBeGreaterThanOrEqual(0);
    // Ordre de priorite : localStorage AVANT matchMedia.
    expect(ls).toBeLessThan(mm);
    expect(THEME_INIT_SCRIPT).toContain("matchMedia");
  });

  it('pose class="dark" et colorScheme en cas sombre', () => {
    expect(THEME_INIT_SCRIPT).toContain('classList.add("dark")');
    expect(THEME_INIT_SCRIPT).toContain("style.colorScheme");
  });

  it("est sur (try/catch) et minimal (vanilla, sans dependance)", () => {
    expect(THEME_INIT_SCRIPT.startsWith("try{")).toBe(true);
    expect(THEME_INIT_SCRIPT.endsWith("catch(e){}")).toBe(true);
    expect(THEME_INIT_SCRIPT.length).toBeLessThanOrEqual(400);
  });
});

/**
 * LOT 5.2 (D-5.2-B) — MotionConfig reducedMotion="user" est deja monte dans
 * __root.tsx (import + provider englobant le contenu principal). On verrouille
 * sa presence par assertion structurelle sur le source : le rendu complet de
 * RootComponent n'est pas isolable en node (contexte TanStack Router + Header
 * + Footer + lazy AdminHeader/ChatWidget + providers supabase), donc on lit
 * le fichier module lui-meme. Limite documentee dans le rapport LOT 5.2.
 */
describe("MotionConfig global (LOT 5.2 — D-5.2-B)", () => {
  const source = readFileSync(new URL("./__root.tsx", import.meta.url), "utf8");

  it("importe MotionConfig depuis framer-motion", () => {
    expect(source).toMatch(/import\s*\{[^}]*MotionConfig[^}]*\}\s*from\s*"framer-motion"/);
  });

  it('monte <MotionConfig reducedMotion="user"> une seule fois', () => {
    const opens = source.match(/<MotionConfig\b[^>]*>/g) ?? [];
    expect(opens).toHaveLength(1);
    expect(opens[0]).toContain('reducedMotion="user"');
  });

  it("MotionConfig englobe le contenu principal (main#main-content et Outlet)", () => {
    const open = source.indexOf("<MotionConfig");
    const main = source.indexOf('id="main-content"');
    const outlet = source.indexOf("<Outlet");
    const close = source.indexOf("</MotionConfig>");
    expect(open).toBeGreaterThanOrEqual(0);
    expect(close).toBeGreaterThan(open);
    expect(main).toBeGreaterThan(open);
    expect(main).toBeLessThan(close);
    expect(outlet).toBeGreaterThan(open);
    expect(outlet).toBeLessThan(close);
  });
});
