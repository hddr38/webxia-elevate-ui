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
    // LOT 6.1 — les cles marquee.pause/play ont ete supprimees du dictionnaire
    // (dead keys). On garde la meme intention : aucun libelle de pause/play,
    // ni FR ni EN, ne doit apparaitre dans le DOM.
    expect(html).not.toContain("Mettre les animations en pause");
    expect(html).not.toContain("Pause animations");
    expect(html).not.toContain("Reprendre les animations");
    expect(html).not.toContain("Play animations");
    // La piste du marquee est toujours la (12 cartes : 6 + 6 clones).
    expect(html).toContain("marquee-track");
  });
});
