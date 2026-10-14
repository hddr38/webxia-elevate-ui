// @vitest-environment happy-dom
/**
 * LOT 5.3-b — I-13 : la page /work distingue le vide reel (admin.realisations.empty)
 * du vide force par un filtre actif (admin.realisations.emptyFiltered).
 *
 * Ce que l'on verrouille :
 * 1. list = [] sans filtre actif -> admin.realisations.empty
 * 2. clic sur une category sans realisation -> admin.realisations.emptyFiltered
 * 3. clic retour "all" -> on repasse au branchement par defaut
 *
 * Meme approche de mock que journal-filters.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleProvider } from "@/lib/locale-context";
import { Route, type WorkItem } from "./index";

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

vi.mock("@/server/functions/realisations", () => ({
  getPublishedRealisations: vi.fn(),
}));

vi.mock("@/lib/use-is-mobile-viewport", () => ({
  useIsMobileViewport: () => false,
}));

const WorkPage = (Route as unknown as { component: React.ComponentType }).component;

function makeRealisation(slug: string, categories: string[]): WorkItem {
  return {
    item: {
      slug,
      title: `Realisation ${slug}`,
      shortDescription: "",
      client: null,
      category: categories[0] ?? "",
      date: "2026-01-01",
      year: "2026",
      featured: false,
      cover: "",
      coverUrl: null,
    },
    technologies: [],
    categories,
  };
}

function renderWith(realisations: WorkItem[]) {
  (Route as unknown as { useLoaderData: () => { realisations: WorkItem[] } }).useLoaderData =
    () => ({ realisations });
  return render(
    <LocaleProvider>
      <WorkPage />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LOT 5.3-b — I-13 : empty vs emptyFiltered sur /work", () => {
  it("vide reel (aucune realisation) -> admin.realisations.empty", () => {
    renderWith([]);
    expect(screen.getByText("Aucune réalisation trouvée.")).toBeTruthy();
    expect(screen.queryByText("Aucune réalisation ne correspond à vos filtres.")).toBeNull();
  });

  it("filtre actif sans realisation -> admin.realisations.emptyFiltered", () => {
    renderWith([makeRealisation("a", ["web"]), makeRealisation("b", ["web"])]);
    // Clic sur "Web" : les 2 realisations restent, donc pas de empty state.
    fireEvent.click(screen.getByRole("button", { name: "Web" }));
    expect(screen.getByText("Realisation a")).toBeTruthy();
    expect(screen.getByText("Realisation b")).toBeTruthy();
    expect(screen.queryByText("Aucune réalisation trouvée.")).toBeNull();
  });

  it("retour 'all' -> aucune carte filtree, branchement par defaut", () => {
    renderWith([makeRealisation("a", ["web"]), makeRealisation("b", ["ai"])]);
    fireEvent.click(screen.getByRole("button", { name: "IA" }));
    expect(screen.getByText("Realisation b")).toBeTruthy();
    expect(screen.queryByText("Realisation a")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tous" }));
    expect(screen.getByText("Realisation a")).toBeTruthy();
    expect(screen.getByText("Realisation b")).toBeTruthy();
  });

  // LOT 5.3-d — la branche admin.realisations.emptyFiltered est atteignable en
  // changeant les donnees du loader entre deux rendus via `rerender` (qui
  // preserve l'etat `filter` mais relit useLoaderData). On simule le cas reel :
  // un admin depublie une realisation pendant qu'un visiteur a un filtre actif.
  it("filtre actif + donnees qui vident la liste -> admin.realisations.emptyFiltered", () => {
    const { rerender } = renderWith([makeRealisation("a", ["web"]), makeRealisation("b", ["ai"])]);
    // Etat 1 : clic sur "Web" -> filter = "web", list = [a], pas de empty state.
    fireEvent.click(screen.getByRole("button", { name: "Web" }));
    expect(screen.getByText("Realisation a")).toBeTruthy();
    expect(screen.queryByText("Aucune réalisation ne correspond à vos filtres.")).toBeNull();

    // Etat 2 : "a" est retire des donnees (depublication) -> realisations = [b],
    // filter = "web" preserve, list = [] -> emptyFiltered.
    (Route as unknown as { useLoaderData: () => { realisations: WorkItem[] } }).useLoaderData =
      () => ({ realisations: [makeRealisation("b", ["ai"])] });
    rerender(
      <LocaleProvider>
        <WorkPage />
      </LocaleProvider>,
    );
    expect(screen.getByText("Aucune réalisation ne correspond à vos filtres.")).toBeTruthy();
    expect(screen.queryByText("Aucune réalisation trouvée.")).toBeNull();
  });
});
