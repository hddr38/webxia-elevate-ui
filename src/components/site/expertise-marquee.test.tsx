/**
 * LOT 43 Phase 5 — bouton pause du marquee RETIRE (taps inutiles sur mobile).
 * La pause reste pilotee par hover/touch/visibilite (animation-play-state).
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ExpertiseMarquee } from "@/components/site/expertise-marquee";

describe("ExpertiseMarquee LOT 43 Phase 5 — bouton pause retire", () => {
  it("aucun bouton pause/play dans le DOM (SSR comme client)", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <ExpertiseMarquee />
      </LocaleProvider>,
    );
    expect(html).not.toContain("marquee.pause");
    expect(html).not.toContain("Mettre les animations en pause");
    expect(html).not.toContain("marquee.play");
    expect(html).not.toContain("Reprendre les animations");
    // La piste du marquee est toujours la (12 cartes : 6 + 6 clones).
    expect(html).toContain("marquee-track");
  });
});
