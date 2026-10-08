// @vitest-environment happy-dom
/**
 * LOT 41 P2 — gate du backdrop-blur du header sur le scroll.
 * Au top : transparent SANS blur (rien a flouter derriere le hero).
 * Apres scroll (> 20 px) : comportement historique (bg + blur).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, render } from "@testing-library/react";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Header } from "@/components/site/header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// rAF manuelle (throttle du listener scroll).
// ---------------------------------------------------------------------------
interface RafEntry {
  id: number;
  cb: FrameRequestCallback;
}
let rafQueue: RafEntry[] = [];
let nextRafId = 1;
const flushRaf = () => {
  const q = rafQueue;
  rafQueue = [];
  for (const { cb } of q) cb(1000);
};

let mockScrollY = 0;

beforeEach(() => {
  mockScrollY = 0;
  rafQueue = [];
  nextRafId = 1;
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => mockScrollY,
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafQueue.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
    rafQueue = rafQueue.filter((e) => e.id !== id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
});

function renderHeader() {
  return render(
    <LocaleProvider>
      <ThemeProvider>
        <Header />
      </ThemeProvider>
    </LocaleProvider>,
  );
}

function bar(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="header-bar"]');
  if (!el) throw new Error("header-bar introuvable");
  return el as HTMLElement;
}

function scrollToY(y: number) {
  mockScrollY = y;
  act(() => {
    window.dispatchEvent(new Event("scroll"));
    flushRaf();
  });
}

describe("Header — gate backdrop-blur LOT 41 P2", () => {
  it("au top : transparent SANS backdrop-blur", () => {
    const { container } = renderHeader();
    const el = bar(container);
    expect(el.dataset.scrolled).toBe("false");
    expect(el.className).not.toContain("backdrop-blur-xl");
    expect(el.className).toContain("bg-background/0");
  });

  it("apres scroll 100 px : blur present, puis retrait au retour top", () => {
    const { container } = renderHeader();
    scrollToY(100);
    const el = bar(container);
    expect(el.dataset.scrolled).toBe("true");
    expect(el.className).toContain("backdrop-blur-xl");
    expect(el.className).not.toContain("bg-background/0");

    scrollToY(0);
    const back = bar(container);
    expect(back.dataset.scrolled).toBe("false");
    expect(back.className).not.toContain("backdrop-blur-xl");
  });
});
