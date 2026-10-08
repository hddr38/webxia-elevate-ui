// @vitest-environment happy-dom
/**
 * LOT 43 Phase 9 — sur mobile (< 768 px) : AUCUNE animation d'entree JS,
 * contenu visible immediatement. Sur desktop : comportement inchange.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ProblemSolution } from "@/components/site/problem-solution";
import { Expertises } from "@/components/site/expertises";
import { WhyChooseUs } from "@/components/site/why-choose-us";
import { DbRealisationCard, CTAStrip } from "@/components/site/project-card";
import { Footer } from "@/components/site/footer";
import type { DisplayRealisation } from "@/lib/mappers";

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

function mockMatchMedia(matches: boolean) {
  const mq = {
    matches,
    media: "(max-width: 767px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => mq,
  });
}

class MockObserver {
  elements: Element[] = [];
  disconnected = false;
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

function Providers({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}

/** Aucun noeud masque en opacity:0 inline (animations neutralisees). */
function expectNoHiddenOpacity(container: HTMLElement) {
  const hidden = container.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]');
  expect(hidden).toHaveLength(0);
}

const demoItem = {
  slug: "demo",
  title: "Demo",
  client: "Client",
  category: "Web",
  year: "2026",
  coverUrl: "",
  cover: "",
  featured: false,
} as unknown as DisplayRealisation;

describe("Sections LOT 43 — mobile sans animations JS", () => {
  const origMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("IntersectionObserver", MockObserver);
    vi.stubGlobal("ResizeObserver", MockObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: origMatchMedia,
    });
  });

  it("ProblemSolution mobile : contenu visible, 0 opacity:0", () => {
    mockMatchMedia(true);
    const { container } = render(
      <Providers>
        <ProblemSolution />
      </Providers>,
    );
    expect(container.textContent).toContain("Avant");
    expectNoHiddenOpacity(container);
  });

  it("Expertises mobile : contenu visible, 0 opacity:0", () => {
    mockMatchMedia(true);
    const { container } = render(
      <Providers>
        <Expertises />
      </Providers>,
    );
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expectNoHiddenOpacity(container);
  });

  it("WhyChooseUs mobile : contenu visible, 0 opacity:0", () => {
    mockMatchMedia(true);
    const { container } = render(
      <Providers>
        <WhyChooseUs />
      </Providers>,
    );
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expectNoHiddenOpacity(container);
  });

  it("DbRealisationCard + CTAStrip mobile : contenu visible, 0 opacity:0", () => {
    mockMatchMedia(true);
    const { container } = render(
      <Providers>
        <DbRealisationCard item={demoItem} technologies={["React"]} index={0} />
        <CTAStrip title="Titre" body="Corps" cta="Go" />
      </Providers>,
    );
    expect(container.textContent).toContain("Demo");
    expect(container.textContent).toContain("Titre");
    expectNoHiddenOpacity(container);
  });

  it("Footer mobile : visible, 0 opacity:0 (fini les 5 noeuds masques)", () => {
    mockMatchMedia(true);
    const { container } = render(
      <Providers>
        <Footer />
      </Providers>,
    );
    expect(container.querySelector("footer")).not.toBeNull();
    expectNoHiddenOpacity(container);
  });

  it("Footer SSR : aucun opacity:0 dans le HTML servi", () => {
    const html = renderToStaticMarkup(
      <Providers>
        <Footer />
      </Providers>,
    );
    expect(html).not.toContain("opacity:0");
    expect(html).not.toContain("opacity: 0");
  });

  it("Desktop : ProblemSolution inchange (contenu visible)", () => {
    mockMatchMedia(false);
    const { container } = render(
      <Providers>
        <ProblemSolution />
      </Providers>,
    );
    expect(container.textContent).toContain("Avant");
    expectNoHiddenOpacity(container);
  });
});
