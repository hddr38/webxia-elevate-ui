// @vitest-environment happy-dom
/**
 * LOT 43 Phase 6 — header OPAQUE PERMANENT (mobile + desktop, top + scrolle).
 * Le gating blur LOT 41 (etat `scrolled`) est retire : 0 listener scroll.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
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

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
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

describe("Header LOT 43 Phase 6 — opaque permanent", () => {
  it("toujours opaque + blur, au top comme scrolle", () => {
    const { container } = renderHeader();
    const el = bar(container);
    expect(el.className).toContain("bg-background/60");
    expect(el.className).toContain("backdrop-blur-xl");
    expect(el.className).not.toContain("bg-background/0");

    // Scroll : classes inchangees (aucune logique `scrolled`).
    window.dispatchEvent(new Event("scroll"));
    const after = bar(container);
    expect(after.className).toContain("bg-background/60");
    expect(after.className).toContain("backdrop-blur-xl");
  });
});
