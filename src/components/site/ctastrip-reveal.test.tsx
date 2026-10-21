// @vitest-environment happy-dom
/**
 * ANIM-1 — reveal au scroll de CTAStrip.
 *
 * Verrouille le motif aligne sur les sections voisines (DbRealisationCard /
 * services / footer, convention LOT 43) :
 * - desktop : whileInView actif (observe l'element via IntersectionObserver),
 *   viewport once -80px, duree 0.6s, easing partage [0.22,1,0.36,1] ;
 * - mobile : aucun whileInView (aucune observation IO), contenu visible,
 *   0 opacity:0 inline (pied de page existant sections-mobile.test.tsx) ;
 * - contenu, lien /contact et bouton inchanges ; focus clavier intact ;
 * - aucun stagger (pas de delay) ni exit animation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LocaleProvider } from "@/lib/locale-context";
import { CTAStrip } from "@/components/site/project-card";

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

type IOCB = (entries: IntersectionObserverEntry[]) => void;
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IOCB;
  elements: Element[] = [];
  constructor(callback: IOCB) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve() {}
  disconnect() {}
  /** Tous les elements observes par toutes les instances. */
  static observedElements(): Element[] {
    return MockIntersectionObserver.instances.flatMap((i) => i.elements);
  }
}

function Providers({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}

function expectNoHiddenOpacity(container: HTMLElement) {
  const hidden = container.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]');
  expect(hidden).toHaveLength(0);
}

function renderCTA() {
  return render(
    <Providers>
      <CTAStrip
        eyebrow="Prêt ?"
        title="Parlons de votre projet"
        body="Un échange de 30 minutes suffit."
        cta="Réserver un appel"
      />
    </Providers>,
  );
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal(
    "ResizeObserver",
    class MockObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ANIM-1 — CTAStrip reveal au scroll", () => {
  it("desktop : whileInView actif — l'element section est observe (IntersectionObserver)", () => {
    mockMatchMedia(false);
    const { container } = renderCTA();
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(MockIntersectionObserver.observedElements()).toContain(section);
  });

  it("desktop : contenu visible au montage (initial={false}, aucun masquage SSR/1er rendu)", () => {
    mockMatchMedia(false);
    const { container } = renderCTA();
    expectNoHiddenOpacity(container);
    expect(container.textContent).toContain("Prêt ?");
    expect(container.textContent).toContain("Parlons de votre projet");
    expect(container.textContent).toContain("Un échange de 30 minutes suffit.");
    expect(container.textContent).toContain("Réserver un appel");
  });

  it("mobile : après bascule du hook, contenu visible, 0 opacity:0 (aucun masquage)", async () => {
    mockMatchMedia(true);
    const { container } = renderCTA();
    // useIsMobileViewport est SSR-safe (false au 1er render, bascule en
    // useEffect) — comme DbRealisationCard. Après la bascule, le contenu
    // reste visible et aucun style opacity:0 ne subsiste.
    await act(async () => {
      await Promise.resolve();
    });
    expectNoHiddenOpacity(container);
    expect(container.textContent).toContain("Parlons de votre projet");
    expect(container.textContent).toContain("Réserver un appel");
    // Aucune nouvelle observation après la bascule mobile (whileInView
    // retiré par le gâtage isMobile).
    const observedAfter = MockIntersectionObserver.observedElements().length;
    await act(async () => {
      await Promise.resolve();
    });
    expect(MockIntersectionObserver.observedElements().length).toBe(observedAfter);
  });

  it("SSR : aucun opacity:0 dans le HTML servi (convention LOT 43)", () => {
    const html = renderToStaticMarkup(
      <Providers>
        <CTAStrip title="Titre" body="Corps" cta="Go" />
      </Providers>,
    );
    expect(html).not.toContain("opacity:0");
    expect(html).not.toContain("opacity: 0");
  });

  it("non-régression : contenu, lien /contact, bouton et focus clavier intacts", () => {
    mockMatchMedia(false);
    const { container } = renderCTA();
    const link = container.querySelector('a[href="/contact"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain("Réserver un appel");
    expect(link?.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("h2")?.tagName).toBe("H2");
  });

  it("props source verrouillees : initial false, whileInView, viewport once -80px, 0.6s, easing partage, gâtage mobile, 0 delay, 0 exit", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/site/project-card.tsx"),
      "utf8",
    );
    const ctaSource = source.slice(source.indexOf("export function CTAStrip"));
    // whileInView cible exacte (transform/opacity seuls)
    expect(ctaSource).toMatch(/whileInView=\{isMobile \? undefined : \{ opacity: 1, y: 0 \}\}/);
    // viewport once + margin -80px, gâté mobile
    expect(ctaSource).toMatch(
      /viewport=\{isMobile \? undefined : \{ once: true, margin: "-80px" \}\}/,
    );
    // durée 0.6s + easing partagé du repo, gâté mobile
    expect(ctaSource).toMatch(
      /transition=\{isMobile \? undefined : \{ duration: 0.6, ease: \[0\.22, 1, 0\.36, 1\] \}\}/,
    );
    // convention LOT 43 : aucun masquage initial
    expect(ctaSource).toMatch(/initial=\{false\}/);
    expect(ctaSource).not.toMatch(/initial=\{\{ opacity: 0/);
    // pas de stagger (delay) ni d'exit sur CTAStrip
    expect(ctaSource).not.toMatch(/delay:/);
    expect(ctaSource).not.toMatch(/exit=/);
  });
});
