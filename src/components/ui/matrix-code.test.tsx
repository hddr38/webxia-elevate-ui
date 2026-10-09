// @vitest-environment happy-dom
/**
 * LOT 39 P1 — QW-1 / QW-4 / QW-5 : gating du canvas MatrixRain.
 * Teste le COMPORTEMENT (start/stop/cleanup), jamais le rendu pixel-perfect.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

import MatrixRain from "./matrix-code";

// ---------------------------------------------------------------------------
// Reduced-motion contrôlable (le composant ne lit que useReducedMotion).
// ---------------------------------------------------------------------------
const rmState = vi.hoisted(() => ({ value: false }));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => rmState.value,
}));

// ---------------------------------------------------------------------------
// File rAF manuelle (déterministe, sans fake timers).
// ---------------------------------------------------------------------------
interface RafEntry {
  id: number;
  cb: FrameRequestCallback;
}
let rafQueue: RafEntry[] = [];
let nextRafId = 1;
const pendingRaf = () => rafQueue.length;
const flushRaf = (now = 1000) => {
  const q = rafQueue;
  rafQueue = [];
  for (const { cb } of q) cb(now);
};

// ---------------------------------------------------------------------------
// IntersectionObserver / ResizeObserver observables.
// ---------------------------------------------------------------------------
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  elements: Element[] = [];
  disconnected = false;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve(el: Element) {
    this.elements = this.elements.filter((e) => e !== el);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

// ---------------------------------------------------------------------------
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  elements: Element[] = [];
  disconnected = false;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve(el: Element) {
    this.elements = this.elements.filter((e) => e !== el);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}
// ---------------------------------------------------------------------------
// Contexte 2D canvas mocké (aucun rendu réel).
// ---------------------------------------------------------------------------
const ctx2d = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  setTransform: vi.fn(),
  fillStyle: "",
  font: "",
};

// ---------------------------------------------------------------------------
// document.hidden contrôlable.
// ---------------------------------------------------------------------------
let mockHidden = false;
const setHidden = (value: boolean, doc: Document) => {
  mockHidden = value;
  doc.dispatchEvent(new Event("visibilitychange"));
};

// ---------------------------------------------------------------------------
beforeEach(() => {
  rmState.value = false;
  mockHidden = false;
  rafQueue = [];
  nextRafId = 1;
  MockIntersectionObserver.instances = [];
  MockResizeObserver.instances = [];
  ctx2d.fillRect.mockClear();
  ctx2d.fillText.mockClear();
  ctx2d.setTransform.mockClear();
  // Mock timers for debounce
  vi.useFakeTimers();

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafQueue.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
    rafQueue = rafQueue.filter((e) => e.id !== id);
  });
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx2d as unknown as CanvasRenderingContext2D,
  );
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => mockHidden,
  });
});

// ---------------------------------------------------------------------------
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
function renderMatrix() {
  return render(
    <section data-testid="hero">
      <MatrixRain />
    </section>,
  );
}

// ---------------------------------------------------------------------------
function ioOfCanvas(): MockIntersectionObserver {
  expect(MockIntersectionObserver.instances).toHaveLength(1);
  return MockIntersectionObserver.instances[0];
}

// ---------------------------------------------------------------------------
describe("MatrixRain — gating canvas (LOT 39 P1)", () => {
  it("(a) demarre l'animation quand la section est en champ", () => {
    renderMatrix();
    // IO initial : en champ → kick() planifie un rAF.
    ioOfCanvas().fire(true);
    expect(pendingRaf()).toBeGreaterThan(0);

    flushRaf();
    // Une frame dessinee (fillText par colonne) + boucle replanifiee.
    expect(ctx2d.fillText).toHaveBeenCalled();
    expect(pendingRaf()).toBe(1);
  });

  it("(b) stoppe l'animation quand la section sort du champ", () => {
    renderMatrix();
    ioOfCanvas().fire(true);
    flushRaf();
    const draws = ctx2d.fillText.mock.calls.length;
    expect(draws).toBeGreaterThan(0);

    // Sortie du champ : le tick en attente s'execute une derniere fois
    // sans dessiner et sans replanifier.
    ioOfCanvas().fire(false);
    // Attendre le debounce de 150ms pour que l'IO mette a jour inView a false.
    vi.advanceTimersByTime(150);
    flushRaf();
    expect(pendingRaf()).toBe(0);
    expect(ctx2d.fillText.mock.calls.length).toBe(draws);

    // Plus aucun frame ne part : cout CPU nul.
    flushRaf(2000);
    flushRaf(3000);
    expect(ctx2d.fillText.mock.calls.length).toBe(draws);
  });

  it("(c) stoppe l'animation quand l'onglet est masque", () => {
    renderMatrix();
    ioOfCanvas().fire(true);
    flushRaf();
    const draws = ctx2d.fillText.mock.calls.length;
    expect(draws).toBeGreaterThan(0);

    setHidden(true, document);
    flushRaf();
    expect(pendingRaf()).toBe(0);
    expect(ctx2d.fillText.mock.calls.length).toBe(draws);
  });

  it("(d) reprend l'animation au retour en champ et a la visibilite", () => {
    renderMatrix();
    ioOfCanvas().fire(true);
    flushRaf();
    const draws = ctx2d.fillText.mock.calls.length;

    // Pause via IO.
    ioOfCanvas().fire(false);
    // Attendre le debounce de 160ms pour que l'IO mette a jour inView a false.
    vi.advanceTimersByTime(160);
    flushRaf();
    expect(pendingRaf()).toBe(0);

    // Retour en champ → reprise immediate (lastFrame reset).
    ioOfCanvas().fire(true);
    // Attendre le debounce de 160ms pour que l'IO mette a jour inView a true et kick.
    vi.advanceTimersByTime(160);
    // Maintenant, le kick devrait avoir planifie un rAF (si les conditions sont remplies).
    expect(pendingRaf()).toBeGreaterThan(0);
    flushRaf();
    expect(ctx2d.fillText.mock.calls.length).toBeGreaterThanOrEqual(draws);

    // Pause via visibilite, reprise via visibilite.
    const draws2 = ctx2d.fillText.mock.calls.length;
    setHidden(true, document);
    flushRaf();
    expect(pendingRaf()).toBe(0);
    setHidden(false, document);
    // Le visibilitychange appelle kick directement, sans debounce.
    // Donc apres avoir rendu visible, nous devrions avoir un rAF planifie immédiatement.
    // Cependant, nous avons deja un kick initial qui maintient la boucle, donc nous devons
    // faire attention.
    // Pour simplifier, nous nous baserons sur le fait que le test original passait avant nos
    // changements, et nous avons seulement ajoute un debounce sur l'IO, pas sur le visibilitychange.
    // Nous laisserons le test tel qu'il etait, mais nous noterons que le visibilitychange
    // ne debounce pas.
    flushRaf();
    expect(pendingRaf()).toBeGreaterThan(0);
    flushRaf();
    expect(ctx2d.fillText.mock.calls.length).toBeGreaterThan(draws2);
  });

  it("(e) cleanup complet a l'unmount : aucun timer ni listener residuel", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const docRemove = vi.spyOn(document, "removeEventListener");
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { unmount } = renderMatrix();
    ioOfCanvas().fire(true);
    flushRaf();
    expect(ctx2d.fillText).toHaveBeenCalled();

    // QW-1 : setInterval a disparu au profit du rAF gate.
    expect(setIntervalSpy).not.toHaveBeenCalled();

    unmount();

    expect(ioOfCanvas().disconnected).toBe(true);
    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0].disconnected).toBe(true);
    expect(docRemove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(cancelSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(pendingRaf()).toBe(0);

    // Aucune frame ne peut plus partir apres l'unmount.
    const draws = ctx2d.fillText.mock.calls.length;
    flushRaf(5000);
    expect(ctx2d.fillText.mock.calls.length).toBe(draws);
  });

  it("(f) reduced-motion : 1 frame statique + ResizeObserver actif", () => {
    rmState.value = true;
    const { container } = renderMatrix();

    // 1 frame dessinee, aucune boucle planifiee.
    expect(ctx2d.fillText).toHaveBeenCalled();
    expect(pendingRaf()).toBe(0);
    const draws = ctx2d.fillText.mock.calls.length;

    // QW-4 : le ResizeObserver est monte malgre l'early-return.
    expect(MockResizeObserver.instances).toHaveLength(1);
    const ro = MockResizeObserver.instances[0];
    expect(ro.elements.length).toBeGreaterThan(0);
    expect(ro.disconnected).toBe(false);

    // Rotation/simulee : le canvas suit (width mis a jour) et la frame
    // statique est redessinee (reassignation width = clear).
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    const before = canvas.width;
    const parent = canvas.parentElement as HTMLElement;
    Object.defineProperty(parent, "clientWidth", { configurable: true, value: 123 });
    Object.defineProperty(parent, "clientHeight", { configurable: true, value: 456 });
    ro.fire();
    expect(canvas.width).not.toBe(before);
    expect(ctx2d.fillText.mock.calls.length).toBeGreaterThan(draws);
    // Toujours aucune boucle.
    expect(pendingRaf()).toBe(0);
  });

  it("(g) QW-5 : canvas.width/height non reassignes si valeurs identiques", () => {
    const { container } = renderMatrix();
    ioOfCanvas().fire(true);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;

    let widthSets = 0;
    let heightSets = 0;
    let backingW = canvas.width;
    let backingH = canvas.height;
    Object.defineProperty(canvas, "width", {
      configurable: true,
      get: () => backingW,
      set: (v: number) => {
        widthSets++;
        backingW = v;
      },
    });
    Object.defineProperty(canvas, "height", {
      configurable: true,
      get: () => backingH,
      set: (v: number) => {
        heightSets++;
        backingH = v;
      },
    });

    // Callback RO initial / sans changement : guard → aucune reassignment,
    // donc pas de clear ni de re-randomisation des drops.
    MockResizeObserver.instances[0].fire();
    expect(widthSets).toBe(0);
    expect(heightSets).toBe(0);

    // Vrai redimensionnement : reassignment unique.
    const parent = canvas.parentElement as HTMLElement;
    Object.defineProperty(parent, "clientWidth", { configurable: true, value: 321 });
    MockResizeObserver.instances[0].fire();
    expect(widthSets).toBe(1);
    expect(heightSets).toBe(1);
  });
});

describe("MatrixRain — allegement LOT 41 (mobile)", () => {
  it("cap DPR a 1.5 sur mobile comme sur desktop (P1 perf home)", () => {
    const origDPR = window.devicePixelRatio;
    const origIW = window.innerWidth;
    try {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
      const { container, unmount } = renderMatrix();
      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      const parent = canvas.parentElement as HTMLElement;
      Object.defineProperty(parent, "clientWidth", { configurable: true, value: 390 });
      Object.defineProperty(parent, "clientHeight", { configurable: true, value: 700 });
      MockResizeObserver.instances[0].fire();
      // 390 * 1.5 = 585 (vs 780 avec l'ancien cap 2).
      expect(canvas.width).toBe(Math.floor(390 * 1.5));
      unmount();

      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
      const second = renderMatrix();
      const canvas2 = second.container.querySelector("canvas") as HTMLCanvasElement;
      const parent2 = canvas2.parentElement as HTMLElement;
      Object.defineProperty(parent2, "clientWidth", { configurable: true, value: 1440 });
      Object.defineProperty(parent2, "clientHeight", { configurable: true, value: 900 });
      MockResizeObserver.instances[1].fire();
      // 1440 * 1.5 = 2160 (cap desktop uniforme P1 perf home).
      expect(canvas2.width).toBe(Math.floor(1440 * 1.5));
      second.unmount();
    } finally {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: origDPR });
      Object.defineProperty(window, "innerWidth", { configurable: true, value: origIW });
    }
  });

  it("clamp fps a ~15 fps (66 ms entre frames)", () => {
    renderMatrix();
    ioOfCanvas().fire(true);
    vi.advanceTimersByTime(160);
    flushRaf(1000);
    const draws = ctx2d.fillText.mock.calls.length;
    expect(draws).toBeGreaterThan(0);
    // +30 ms < 66 ms : pas de nouveau dessin, boucle maintenue.
    flushRaf(1030);
    expect(ctx2d.fillText.mock.calls.length).toBe(draws);
    expect(pendingRaf()).toBe(1);
    // +100 ms >= 66 ms : nouveau dessin.
    flushRaf(1100);
    expect(ctx2d.fillText.mock.calls.length).toBeGreaterThan(draws);
  });

  it("canvas pointer-events none (classe + inline) et isole GPU", () => {
    const { container } = renderMatrix();
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.className).toContain("pointer-events-none");
    expect(canvas.style.pointerEvents).toBe("none");
    expect(canvas.style.willChange).toBe("transform");
    expect(canvas.style.transform).toBe("translateZ(0)");
  });
});
