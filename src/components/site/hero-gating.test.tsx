// @vitest-environment happy-dom
/**
 * LOT 39 P3 (QW-7, bug B-3) — le canvas du hero monte cote client
 * uniquement, UNE fois, dans la variante du theme resolu. Pas de
 * double montage MatrixRain → ParticleField.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
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

// IO/RO observables (les effets canvas + marquee les utilisent).
class MockObserver {
  static ios: MockObserver[] = [];
  static ros: MockObserver[] = [];
  elements: Element[] = [];
  disconnected = false;
  constructor(
    _cb: (...args: never[]) => void,
    private readonly kind: "io" | "ro",
  ) {
    (kind === "io" ? MockObserver.ios : MockObserver.ros).push(this);
  }
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

// Contexte 2D mocké (aucun rendu réel, effets canvas actifs).
const ctx2d = {
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
  MockObserver.ios = [];
  MockObserver.ros = [];
  for (const k of [
    "fillRect",
    "fillText",
    "clearRect",
    "beginPath",
    "arc",
    "fill",
    "setTransform",
  ] as const) {
    ctx2d[k].mockClear();
  }
  vi.stubGlobal(
    "IntersectionObserver",
    class extends MockObserver {
      constructor(cb: (...args: never[]) => void) {
        super(cb, "io");
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class extends MockObserver {
      constructor(cb: (...args: never[]) => void) {
        super(cb, "ro");
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx2d as unknown as CanvasRenderingContext2D,
  );
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderHero() {
  return render(
    <LocaleProvider>
      <ThemeProvider>
        <Hero />
      </ThemeProvider>
    </LocaleProvider>,
  );
}

describe("Hero client-only canvas (LOT 39 P3 — QW-7)", () => {
  it("theme dark → EXACTEMENT 1 canvas MatrixRain (pas de double)", () => {
    window.localStorage.setItem("webxia-theme", "dark");
    const { container } = renderHero();
    const canvases = container.querySelectorAll("canvas");
    expect(canvases).toHaveLength(1);
    expect(canvases[0].className).toContain("opacity-60");
  });

  it("theme light → EXACTEMENT 1 canvas ParticleField (pas de double)", () => {
    window.localStorage.setItem("webxia-theme", "light");
    const { container } = renderHero();
    const canvases = container.querySelectorAll("canvas");
    expect(canvases).toHaveLength(1);
    expect(canvases[0].className).toContain("opacity-70");
  });

  it("unmount → canvas retire, observers deconnectes (cleanup P1 intact)", () => {
    window.localStorage.setItem("webxia-theme", "dark");
    const { container, unmount } = renderHero();
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(MockObserver.ios.length).toBeGreaterThan(0);

    unmount();

    expect(container.querySelectorAll("canvas")).toHaveLength(0);
    for (const io of MockObserver.ios) expect(io.disconnected).toBe(true);
    for (const ro of MockObserver.ros) expect(ro.disconnected).toBe(true);
  });
});
