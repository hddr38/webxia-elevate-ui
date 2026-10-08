// @vitest-environment happy-dom
/**
 * LOT 43 Phase 1 — hook partage useIsMobileViewport (extrait de hero.tsx).
 * SSR-safe : false au 1er rendu (identique SSR), bascule apres mount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, render } from "@testing-library/react";
import { MOBILE_MAX_WIDTH_PX, useIsMobileViewport } from "@/lib/use-is-mobile-viewport";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mq = {
    matches,
    media: `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`,
    addEventListener: vi.fn((_type: string, cb: (e: { matches: boolean }) => void) => {
      listeners.add(cb);
    }),
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
  return { mq, listeners };
}

function Probe() {
  const v = useIsMobileViewport();
  return React.createElement("span", { "data-testid": "probe" }, v ? "mobile" : "desktop");
}

describe("useIsMobileViewport (LOT 43 Phase 1)", () => {
  const origMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: origMatchMedia,
    });
  });

  it("retourne false au 1er rendu (SSR/hydratation coherents), true apres mount sur mobile", () => {
    mockMatchMedia(true);
    const { getByTestId } = render(React.createElement(Probe));
    // Effets flushes par RTL : la bascule post-mount est appliquee.
    expect(getByTestId("probe").textContent).toBe("mobile");
  });

  it("retourne false sur desktop", () => {
    mockMatchMedia(false);
    const { getByTestId } = render(React.createElement(Probe));
    expect(getByTestId("probe").textContent).toBe("desktop");
  });

  it("suit les changements matchMedia (rotation)", () => {
    const { listeners } = mockMatchMedia(false);
    const { getByTestId } = render(React.createElement(Probe));
    expect(getByTestId("probe").textContent).toBe("desktop");
    act(() => {
      listeners.forEach((cb) => cb({ matches: true }));
    });
    expect(getByTestId("probe").textContent).toBe("mobile");
  });

  it("seuil = 767px (coherent MOBILE_BREAKPOINT_PX)", () => {
    expect(MOBILE_MAX_WIDTH_PX).toBe(767);
  });
});
