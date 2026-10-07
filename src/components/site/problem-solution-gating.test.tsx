// @vitest-environment happy-dom
/**
 * LOT 39 P2 — QW-3 : l'oscillation infinie des fleches est gatee par
 * visibilite (useInView framer-motion → IntersectionObserver).
 *
 * Sous happy-dom, framer-motion utilise son moteur JS sur rAF natif
 * (capture a l'import : non interceptable). Preuve comportementale en
 * temps reel sur l'inline transform des fleches : hors champ → fige ;
 * en champ → avance ; sortie → fige apres le retour au repos (x:0).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";
import { LocaleProvider } from "@/lib/locale-context";
import { ProblemSolution } from "@/components/site/problem-solution";

vi.mock("@tanstack/react-router", () => ({
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

// ---------------------------------------------------------------------------
// IntersectionObserver controllable (framer-motion l'utilise pour
// useInView ET whileInView : on pilote tout via fireAll).
// ---------------------------------------------------------------------------
type IOCB = (entries: IntersectionObserverEntry[]) => void;
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IOCB;
  elements: Element[] = [];
  constructor(callback: IOCB) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve() {}
  disconnect() {}
  static fireAll(isIntersecting: boolean) {
    for (const inst of MockIntersectionObserver.instances) {
      // framer-motion indexe ses handlers par entry.target (WeakMap).
      const entries = inst.elements.map(
        (el) => ({ isIntersecting, target: el }) as IntersectionObserverEntry,
      );
      inst.callback(entries);
    }
  }
}

// ---------------------------------------------------------------------------
// Quirk happy-dom/vitest : les elements happy-dom ne passent pas
// `instanceof EventTarget` (classe Node-native vs classe happy-dom), donc
// framer-motion croit que les refs sont vides et n'observe jamais rien.
// En vrai navigateur, div instanceof EventTarget === true.
// Workaround local a ce fichier : tout noeud DOM passe le test.
Object.defineProperty(EventTarget, Symbol.hasInstance, {
  configurable: true,
  value: (obj: unknown): boolean => typeof obj === "object" && obj !== null && "nodeType" in obj,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Attend que les transforms se figent (boucle arretee + retour au repos). */
async function waitForFrozen(container: HTMLElement, timeoutMs = 6000): Promise<string[]> {
  const start = Date.now();
  let prev = arrowTransforms(container);
  for (;;) {
    await sleep(400);
    const cur = arrowTransforms(container);
    if (cur.length === prev.length && cur.every((v, i) => v === prev[i])) return cur;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`transforms never froze: ${JSON.stringify(cur)}`);
    }
    prev = cur;
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderProblemSolution() {
  return render(
    <LocaleProvider>
      <ProblemSolution />
    </LocaleProvider>,
  );
}

/** Inline transforms des 2 divs d'oscillation (.text-brand/30). */
function arrowTransforms(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".text-brand\\/30")].map(
    (el) => (el as HTMLElement).style.transform || "",
  );
}

describe("ProblemSolution QW-3 — fleches gatees par visibilite", () => {
  it("aucune oscillation tant que la section est hors champ", async () => {
    const { container } = renderProblemSolution();
    expect(arrowTransforms(container)).toHaveLength(2);

    // IO jamais declenche → animate={x:0} partout, entrees non jouees.
    await sleep(300);
    const t0 = arrowTransforms(container);
    await sleep(500);
    expect(arrowTransforms(container)).toEqual(t0);
  });

  it("oscillation en champ, figee hors champ, relancee au retour", async () => {
    const { container } = renderProblemSolution();
    await sleep(200);

    // Entree en champ → l'oscillation avance (boucle x infinie).
    act(() => {
      MockIntersectionObserver.fireAll(true);
    });
    await sleep(400);
    const running = arrowTransforms(container);
    await sleep(600);
    const advanced = arrowTransforms(container);
    expect(advanced).not.toEqual(running);

    // Sortie de champ → boucle infinie annulee + retour au repos (x:0),
    // puis transforms figes (aucune frame).
    act(() => {
      MockIntersectionObserver.fireAll(false);
    });
    const frozen = await waitForFrozen(container);
    await sleep(600);
    expect(arrowTransforms(container)).toEqual(frozen);

    // Retour en champ → l'oscillation repart.
    act(() => {
      MockIntersectionObserver.fireAll(true);
    });
    await sleep(400);
    const resumed = arrowTransforms(container);
    await sleep(600);
    expect(arrowTransforms(container)).not.toEqual(resumed);
    expect(arrowTransforms(container)).not.toEqual(frozen);
  });
});
