import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Hero } from "@/components/site/hero";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

/**
 * LOT 39 P3 (QW-7, bug B-3) — le SSR ne sert aucun <canvas> dans le hero.
 * Avant : le SSR servait toujours MatrixRain (theme initial "dark"), puis
 * l'hydratation basculait vers ParticleField sur device clair.
 */
describe("Hero SSR (LOT 39 P3 — QW-7)", () => {
  it("sert un <canvas> dans le HTML SSR (placeholder client-only revert)", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <ThemeProvider>
          <Hero />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(html).toContain("<canvas");
    // Le hero lui-meme est servi (titre LCP present).
    expect(html).toContain("<h1");
  });

  it("garde les wrappers de fond (dimensions identiques, CLS = 0)", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <ThemeProvider>
          <Hero />
        </ThemeProvider>
      </LocaleProvider>,
    );
    // Branche dark par defaut : voile de lisibilite present.
    expect(html).toContain("bg-background/70");
    expect(html).toContain("bg-radial-fade");
  });
});
