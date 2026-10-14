// @vitest-environment happy-dom
/**
 * LOT 5.2 — le ping du FloatingCTA n'est plus permanent :
 * - jamais de `animate-ping` nu (classe de base) ;
 * - conditionne au hover ET au focus-visible du parent (le <Link> porte `group`) ;
 * - neutralise sous prefers-reduced-motion (`motion-reduce:animate-none`).
 * Approche : renderToStaticMarkup (node) + inspection des classes — meme
 * approche que ChatMessage.test.tsx / sections-mobile.test.tsx (Footer SSR).
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { FloatingCTA } from "@/components/site/floating-cta";

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
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: "/about" } }),
}));

function classesOf(el: Element | null | undefined): string[] {
  return (el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function renderCta(): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <FloatingCTA />
    </LocaleProvider>,
  );
}

describe("FloatingCTA ping conditionne (LOT 5.2)", () => {
  it("le span ping porte group-hover + group-focus-visible + motion-reduce:animate-none", () => {
    const html = renderCta();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ping = [...doc.querySelectorAll("span")].find((s) => classesOf(s).includes("opacity-40"));
    expect(ping).toBeDefined();
    const classes = classesOf(ping);
    expect(classes).toContain("group-hover:animate-ping");
    expect(classes).toContain("group-focus-visible:animate-ping");
    expect(classes).toContain("motion-reduce:animate-none");
  });

  it("AUCUN animate-ping nu (pas d'animation permanente au repos)", () => {
    const html = renderCta();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ping = [...doc.querySelectorAll("span")].find((s) => classesOf(s).includes("opacity-40"));
    expect(ping).toBeDefined();
    // Les variantes contiennent "animate-ping" en suffixe ; on exclut le token exact.
    const classes = classesOf(ping);
    expect(classes).not.toContain("animate-ping");
  });

  it("le parent <Link> porte `group` (necessaire pour group-hover/focus-visible)", () => {
    const html = renderCta();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const link = doc.querySelector("a");
    expect(link).not.toBeNull();
    expect(classesOf(link)).toContain("group");
  });
});
