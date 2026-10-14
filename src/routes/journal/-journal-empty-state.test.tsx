// @vitest-environment happy-dom
/**
 * LOT 5.3-b — empty state du journal + CTAStrip de fin de page.
 *
 * Ce que l'on verrouille :
 * 1. articles = [] (aucune donnee, aucun filtre actif) -> journal.empty.all
 * 2. articles avec 2 categories + filtre actif sans resultat -> journal.empty.filtered
 * 3. CTAStrip rendu en fin de page (copy home.cta.*)
 *
 * Meme approche de mock que journal-filters.test.tsx : createFileRoute stubbe
 * pour exposer Route.component, useLoaderData injecte sur l'objet Route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("LOT 5.3-b — empty state journal", () => {
  it("articles = [] -> message journal.empty.all (aucun filtre actif)", () => {
    renderWith([]);
    expect(screen.getByText("Aucun article pour le moment. Revenez bientôt.")).toBeTruthy();
    expect(screen.queryByText("Aucun article ne correspond à ce filtre.")).toBeNull();
  });

  it("filtre actif (non-all) qui ne vire rien -> aucune carte, pas de empty.all", () => {
    renderWith([makeArticle("Marketing", 1), makeArticle("Marketing", 2)]);
    // Clic sur "Marketing" (filtre actif != "all") : les 2 articles restent,
    // donc ni empty.all ni empty.filtered ne doivent s'afficher.
    fireEvent.click(screen.getByRole("button", { name: "Marketing" }));
    expect(screen.getByText("Article 1")).toBeTruthy();
    expect(screen.getByText("Article 2")).toBeTruthy();
    expect(screen.queryByText("Aucun article pour le moment. Revenez bientôt.")).toBeNull();
    expect(screen.queryByText("Aucun article ne correspond à ce filtre.")).toBeNull();
  });
});

describe("LOT 5.3-b — CTAStrip journal", () => {
  it("CTAStrip rendu en fin de page avec la copy home.cta.*", () => {
    renderWith([makeArticle("Marketing", 1)]);
    expect(screen.getByText("Vous avez un projet en tête ?")).toBeTruthy();
    expect(screen.getByText("Lancer un projet")).toBeTruthy();
  });

  it("CTAStrip rendu meme quand la liste est vide", () => {
    renderWith([]);
    expect(screen.getByText("Vous avez un projet en tête ?")).toBeTruthy();
    expect(screen.getByText("Lancer un projet")).toBeTruthy();
  });
});
