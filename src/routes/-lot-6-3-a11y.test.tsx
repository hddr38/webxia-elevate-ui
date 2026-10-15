// @vitest-environment happy-dom
/**
 * LOT 6.3 — corrections d'accessibilite (audit Phase 0) :
 * 1. /contact  : h1 -> h2 (BookingCalendar + formulaire), plus de saut h1->h3.
 * 2. /services : verrouille la hierarchie DÉJÀ correcte h1 -> h2 -> h3 (garde-fou
 *    contre une regression ; l'audit signalait un faux positif base sur l'ordre
 *    des lignes fichier, pas l'ordre DOM).
 * 3. /about   : la section "Notre methode" porte un id="process" stable.
 * 4. Footer   : l'ancre "Notre methode" pointe vers /about#process (et non plus
 *    /about#realisations, qui designait la mauvaise section).
 *
 * Approche de mock alignee sur work-empty-state.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/locale-context";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (config: Record<string, unknown>) => config,
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

vi.mock("@/lib/use-is-mobile-viewport", () => ({
  useIsMobileViewport: () => false,
}));

vi.mock("@/server/functions/contact", () => ({
  submitContactMessage: vi.fn(),
}));

vi.mock("@/server/functions/realisations", () => ({
  getPublishedRealisations: vi.fn(),
}));

// BookingCalendar charge Cal.com via un <script> en useEffect : on le remplace
// par un stub qui rend uniquement un titre h2, pour tester la hierarchie sans
// dependre d'un reseau ni d'un iframe.
vi.mock("@/components/ui/booking-calendar", () => ({
  BookingCalendar: () => <h2 data-testid="booking-stub">Booking</h2>,
}));

import { Route as ServicesRoute } from "@/routes/services";
import { Route as AboutRoute } from "@/routes/about";
import { Contact } from "@/components/site/contact";
import { Footer } from "@/components/site/footer";

const ServicesPage = (ServicesRoute as unknown as { component: React.ComponentType }).component;
const AboutPage = (AboutRoute as unknown as { component: React.ComponentType }).component;

/** Aucun saut de niveau : h(N) -> h(N+1) max. Un saut h1->h3 est rejete. */
function expectNoHeadingSkip(container: HTMLElement) {
  const headings = Array.from(container.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  let prev = 0;
  for (const h of headings) {
    const level = Number(h.tagName.charAt(1));
    if (prev !== 0) {
      expect(
        level,
        `saut de titre h${prev} -> h${level} ("${(h.textContent ?? "").trim().slice(0, 40)}")`,
      ).toBeLessThanOrEqual(prev + 1);
    }
    prev = level;
  }
}

function expectSingleH1(container: HTMLElement) {
  expect(container.querySelectorAll("h1").length).toBe(1);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LOT 6.3 — /contact : h1 unique, h2 avant h3 (pas de saut h1->h3)", () => {
  it("hiérarchie valide : h1 -> h2 (rendez-vous) -> h2 (formulaire)", () => {
    const { container } = render(
      <LocaleProvider>
        <Contact />
      </LocaleProvider>,
    );
    expectSingleH1(container);
    expectNoHeadingSkip(container);
    // Les deux titres de section sont bien des h2 (et non des h3).
    expect(screen.getByRole("heading", { level: 2, name: "Booking" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Envoyez-nous un message" })).toBeTruthy();
    // Plus aucun h3 de section apres le h1 (les seuls h3 restants seraient dans
    // le footer, non rendu ici).
    expect(container.querySelector("h3")).toBeNull();
  });
});

describe("LOT 6.3 — /services : hierarchie h1 -> h2 -> h3 verrouillée", () => {
  it("h1 unique, chaque h3 de carte precede d'un h2 de section", () => {
    const { container } = render(
      <LocaleProvider>
        <ServicesPage />
      </LocaleProvider>,
    );
    expectSingleH1(container);
    expectNoHeadingSkip(container);
    // Le premier titre apres le h1 est un h2 (section), jamais un h3 (carte).
    const headings = Array.from(container.querySelectorAll("h1,h2,h3"));
    const firstAfterH1 = headings[1];
    expect(firstAfterH1?.tagName).toBe("H2");
  });
});

describe('LOT 6.3 — /about : id="process" stable sur la section méthode', () => {
  it("la section « Notre méthode » expose un id=process atteignable par ancre", () => {
    (AboutRoute as unknown as { useLoaderData: () => { work: [] } }).useLoaderData = () => ({
      work: [],
    });
    const { container } = render(
      <LocaleProvider>
        <AboutPage />
      </LocaleProvider>,
    );
    const processSection = container.querySelector("#process");
    expect(processSection).toBeTruthy();
    // Le h2 de cette section est bien « Notre méthode ».
    const h2 = processSection?.querySelector("h2");
    expect(h2?.textContent).toBe("Notre méthode");
  });
});

describe("LOT 6.3 — Footer : ancre « Notre méthode » -> /about#process", () => {
  it("le lien d'ancre du footer cible /about#process (et non /about#realisations)", () => {
    render(
      <LocaleProvider>
        <Footer />
      </LocaleProvider>,
    );
    const link = screen.getByRole("link", { name: "Notre méthode" });
    expect(link.getAttribute("href")).toBe("/about#process");
    // Garde-fou : plus aucune reference a l'ancienne ancre ciblee par erreur.
    const allHrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(allHrefs).not.toContain("/about#realisations");
  });
});
