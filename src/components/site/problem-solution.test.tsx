import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ProblemSolution } from "@/components/site/problem-solution";

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

function renderSSR(): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <ProblemSolution />
    </LocaleProvider>,
  );
}

describe("ProblemSolution SSR (LOT 39 P2 — QW-2, bug B-1)", () => {
  it("ne sert aucun noeud en opacity:0 dans la section", () => {
    const html = renderSSR();
    // Avant QW-2 : 13 noeuds en style="opacity:0;transform:translateY(8px)".
    expect(html).not.toContain("opacity:0");
    expect(html).not.toContain("opacity: 0");
    expect(html).not.toContain("translateY(8px)");
    expect(html).not.toContain("scale(0.8)");
  });

  it("sert le contenu complet (titres, cartes, items, fleches)", () => {
    const html = renderSSR();
    // Eyebrow "Avant / Apres" (FR par defaut).
    expect(html).toContain("Avant / Après");
    // 2 cartes (defis + solutions).
    expect(html.match(/<article/g)?.length).toBe(2);
    // 8 items (4 defis + 4 solutions).
    expect(html.match(/<li[ >]/g)?.length).toBe(8);
    // 2 fleches d'oscillation (wrappers desktop + mobile).
    expect(html).toContain("hidden md:flex items-center justify-center");
    expect(html).toContain("flex md:hidden items-center justify-center py-2");
    // Icones Lucide rendues (XCircle, CheckCircle2, ArrowRight).
    expect(html.match(/lucide-/g)?.length).toBeGreaterThanOrEqual(10);
  });
});
