import { describe, it, expect } from "vitest";
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
