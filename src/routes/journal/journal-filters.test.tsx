// @vitest-environment happy-dom
/**
 * LOT 5.3-a — filtres journal derives depuis les categories reelles en base.
 *
 * Ce que l'on verrouille :
 * 1. Derivation : filters = ["all", ...Set(categories).sort()]
 * 2. Gate : la barre de filtres disparait si filters.length <= 1 (aucun article)
 * 3. a11y : aria-pressed sur chaque bouton, min-h-[44px] + focus-visible:ring-2
 *
 * Approche de mock : le composant JournalPage n'est pas exporte et lit les
 * articles via Route.useLoaderData(). On remplace createFileRoute par un stub
 * qui retourne la config directement (le composant devient Route.component),
 * on injecte useLoaderData sur l'objet Route, puis on rend avec
 * @testing-library/react (meme pattern que sections-mobile.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { DisplayArticle } from "@/lib/mappers";
import { LocaleProvider } from "@/lib/locale-context";
import { Route } from "./index";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (config: { component: React.ComponentType }) => config,
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

vi.mock("@/server/functions/articles", () => ({
  getPublishedArticles: vi.fn(),
}));

vi.mock("@/lib/use-is-mobile-viewport", () => ({
  useIsMobileViewport: () => false,
}));

// Le stub createFileRoute retourne la config directement, donc Route EST la
// config ({ component }) au runtime ; le type Route de TanStack ne l'expose pas.
const JournalPage = (Route as unknown as { component: React.ComponentType }).component;

function makeArticle(category: string, i: number): DisplayArticle {
  return {
    slug: `article-${i}`,
    title: `Article ${i}`,
    excerpt: "",
    category,
    date: "2026-01-01",
    readingMinutes: 5,
    author: "WebXIA",
    cover: "",
    content: [],
  };
}

function renderWith(articles: DisplayArticle[]) {
  (Route as unknown as { useLoaderData: () => { articles: DisplayArticle[] } }).useLoaderData =
    () => ({ articles });
  return render(
    <LocaleProvider>
      <JournalPage />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LOT 5.3-a — filtres journal derives + a11y", () => {
  it("derivation : filters = [all, Intelligence artificielle, Marketing] tries", () => {
    renderWith([makeArticle("Marketing", 1), makeArticle("Intelligence artificielle", 2)]);
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["Tous", "Intelligence artificielle", "Marketing"]);
  });

  it("gate : aucun bouton de filtre si articles = []", () => {
    renderWith([]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("aria-pressed : le bouton actif (all par defaut) a aria-pressed=true, les autres false", () => {
    renderWith([makeArticle("Marketing", 1), makeArticle("Intelligence artificielle", 2)]);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[2].getAttribute("aria-pressed")).toBe("false");
  });

  it("classe min-h-[44px] et sm:min-h-0 sur chaque bouton", () => {
    renderWith([makeArticle("Marketing", 1)]);
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("min-h-[44px]");
      expect(b.className).toContain("sm:min-h-0");
    }
  });

  it("classe focus-visible:ring-2 et focus-visible:outline-none sur chaque bouton", () => {
    renderWith([makeArticle("Marketing", 1)]);
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("focus-visible:ring-2");
      expect(b.className).toContain("focus-visible:outline-none");
    }
  });
});
