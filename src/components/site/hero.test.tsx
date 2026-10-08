// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Hero } from "@/components/site/hero";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";

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

/**
 * LOT 42 — retrait du canvas sur mobile (fallback CSS anime).
 * Desktop (>= 768 px) : canvas comme avant. Mobile (< 768 px) : aucun
 * canvas, fallback `.matrix-css-fallback` (memes dimensions, CLS = 0).
 */
describe("Hero LOT 42 — canvas desktop, fallback mobile", () => {
  const origMatchMedia = window.matchMedia;

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
    return mq;
  }

  // Effets canvas/marquee actifs : IO/RO observables + contexte 2D bouche.
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

  const ctxStub = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    shadowColor: "",
    shadowBlur: 0,
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("IntersectionObserver", MockObserver);
    vi.stubGlobal("ResizeObserver", MockObserver);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D,
    );
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

  function Probe() {
    const v = useIsMobileViewport();
    return <span data-testid="probe">{v ? "mobile" : "desktop"}</span>;
  }

  function renderProbe() {
    return render(<Probe />);
  }

  function renderHero() {
    return render(
      <LocaleProvider>
        <ThemeProvider>
          <Hero />
        </ThemeProvider>
      </LocaleProvider>,
    );
  }

  it("useIsMobileViewport retourne true si (max-width: 767px) matche", () => {
    mockMatchMedia(true);
    const { getByTestId } = renderProbe();
    expect(getByTestId("probe").textContent).toBe("mobile");
  });

  it("useIsMobileViewport retourne false sinon", () => {
    mockMatchMedia(false);
    const { getByTestId } = renderProbe();
    expect(getByTestId("probe").textContent).toBe("desktop");
  });

  it("mobile : AUCUN canvas, fallback present (memes dimensions)", () => {
    mockMatchMedia(true);
    const { container } = renderHero();
    expect(container.querySelectorAll("canvas")).toHaveLength(0);
    const fallback = container.querySelector('[data-testid="hero-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.className).toContain("matrix-css-fallback");
  });

  it("desktop : canvas present, pas de fallback", () => {
    mockMatchMedia(false);
    const { container } = renderHero();
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(container.querySelector('[data-testid="hero-fallback"]')).toBeNull();
  });
});
