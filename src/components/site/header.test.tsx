// @vitest-environment happy-dom
/**
 * LOT 43 Phase 6 — header OPAQUE PERMANENT (mobile + desktop, top + scrolle).
 * Le gating blur LOT 41 (etat `scrolled`) est retire : 0 listener scroll.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Header, LocaleSwitcher } from "@/components/site/header";

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
    expect(el.className).toContain("backdrop-blur-md");
    expect(el.className).not.toContain("bg-background/0");

    // Scroll : classes inchangees (aucune logique `scrolled`).
    window.dispatchEvent(new Event("scroll"));
    const after = bar(container);
    expect(after.className).toContain("bg-background/60");
    expect(after.className).toContain("backdrop-blur-md");
  });
});

describe("LOT 6.3 — LocaleSwitcher : aria-label i18n (group), boutons distinguables", () => {
  function renderSwitcher() {
    return render(
      <LocaleProvider>
        <LocaleSwitcher />
      </LocaleProvider>,
    );
  }

  it("group avec aria-label generic localise (FR par defaut), pas de aria-label codé en dur par bouton", () => {
    const { container } = renderSwitcher();
    const group = container.querySelector('[role="group"]');
    expect(group).toBeTruthy();
    // Locale par defaut = fr.
    expect(group?.getAttribute("aria-label")).toBe("Changer de langue");

    // Les boutons n'ont PLUS de aria-label hardcoded "Switch to XX" : leur nom
    // accessible est le texte visible "EN"/"FR" (distinguables).
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["EN", "FR"]);
    for (const b of buttons) {
      expect(b.getAttribute("aria-label")).toBeNull();
    }
  });

  it("aria-label suit la locale : 'Changer de langue' (fr) -> 'Switch language' (en)", () => {
    const { container } = renderSwitcher();
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe("Changer de langue");

    // Bascule vers EN (bouton dont le texte visible est "EN").
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(group?.getAttribute("aria-label")).toBe("Switch language");
  });

  it("aria-pressed reflete la locale active", () => {
    renderSwitcher();
    const en = screen.getByRole("button", { name: "EN" });
    const fr = screen.getByRole("button", { name: "FR" });
    // Defaut fr : FR est presse.
    expect(fr.getAttribute("aria-pressed")).toBe("true");
    expect(en.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(en);
    expect(en.getAttribute("aria-pressed")).toBe("true");
    expect(fr.getAttribute("aria-pressed")).toBe("false");
  });
});
