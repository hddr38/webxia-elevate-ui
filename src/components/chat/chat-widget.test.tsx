// @vitest-environment happy-dom
/**
 * LOT 5.2 — le ping du lanceur ChatWidget n'est plus permanent :
 * - jamais de `animate-ping` nu (classe de base) ;
 * - conditionne au hover ET au focus-visible du bouton (qui porte `group`) ;
 * - neutralise sous prefers-reduced-motion (`motion-reduce:animate-none`).
 * Approche : renderToStaticMarkup (node) + mocks de use-chat / ChatWindow
 * (le stack chat reel — zustand + server functions — n'est pas isole ici).
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ChatWidget } from "@/components/chat/ChatWidget";

vi.mock("@/hooks/use-chat", () => ({
  useChat: () => ({ isOpen: false, close: vi.fn(), toggle: vi.fn() }),
  abortActiveStream: vi.fn(),
}));
vi.mock("@/components/chat/ChatWindow", () => ({ ChatWindow: () => null }));

function classesOf(el: Element | null | undefined): string[] {
  return (el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function renderWidget(): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <ChatWidget />
    </LocaleProvider>,
  );
}

describe("ChatWidget ping conditionne (LOT 5.2)", () => {
  it("le span ping porte group-hover + group-focus-visible + motion-reduce:animate-none", () => {
    const html = renderWidget();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ping = [...doc.querySelectorAll("span")].find((s) => classesOf(s).includes("opacity-40"));
    expect(ping).toBeDefined();
    const classes = classesOf(ping);
    expect(classes).toContain("group-hover:animate-ping");
    expect(classes).toContain("group-focus-visible:animate-ping");
    expect(classes).toContain("motion-reduce:animate-none");
  });

  it("AUCUN animate-ping nu (pas d'animation permanente au repos)", () => {
    const html = renderWidget();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ping = [...doc.querySelectorAll("span")].find((s) => classesOf(s).includes("opacity-40"));
    expect(ping).toBeDefined();
    const classes = classesOf(ping);
    expect(classes).not.toContain("animate-ping");
  });

  it("le bouton lanceur porte `group` + aria-label (focus clavier intact)", () => {
    const html = renderWidget();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const button = doc.querySelector("button[data-webi-launcher]");
    expect(button).not.toBeNull();
    expect(classesOf(button)).toContain("group");
    expect(button?.getAttribute("aria-label")).toBeTruthy();
  });
});
