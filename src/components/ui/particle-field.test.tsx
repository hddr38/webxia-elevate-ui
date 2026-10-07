// @vitest-environment happy-dom
/**
 * LOT 39 P1 — QW-1 : gating du canvas ParticleField.
 * Teste le COMPORTEMENT (start/stop/cleanup), jamais le rendu pixel-perfect.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

import ParticleField from "./particle-field";

// ---------------------------------------------------------------------------
// Reduced-motion contrôlable.
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
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  setTransform: vi.fn(),
  globalAlpha: 1,
  fillStyle: "",
  shadowColor: "",
  shadowBlur: 0,
};

// ---------------------------------------------------------------------------
// document.hidden contrôlable.
// ---------------------------------------------------------------------------
let mockHidden = false;
const setHidden = (value: boolean, doc: Document) => {
  mockHidden = value;
  doc.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  rmState.value = false;
  mockHidden = false;
  rafQueue = [];
  nextRafId = 1;
  MockIntersectionObserver.instances = [];
  MockResizeObserver.instances = [];
  ctx2d.clearRect.mockClear();
  ctx2d.beginPath.mockClear();
  ctx2d.arc.mockClear();
  ctx2d.fill.mockClear();
  ctx2d.setTransform.mockClear();

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderParticles() {
  return render(
    <section data-testid="hero">
      <ParticleField />
    </section>,
  );
}

function ioOfCanvas(): MockIntersectionObserver {
  expect(MockIntersectionObserver.instances).toHaveLength(1);
  return MockIntersectionObserver.instances[0];
}

describe("ParticleField — gating canvas (LOT 39 P1)", () => {
  it("(a) demarre l'animation quand la section est en champ", () => {
    renderParticles();
    ioOfCanvas().fire(true);
    expect(pendingRaf()).toBeGreaterThan(0);

    flushRaf();
    // Une frame dessinee (169 particules par defaut : 13x13) + boucle active.
    expect(ctx2d.arc).toHaveBeenCalled();
    expect(ctx2d.clearRect).toHaveBeenCalled();
    expect(pendingRaf()).toBe(1);
  });

  it("(b) stoppe l'animation quand la section sort du champ", () => {
    renderParticles();
    ioOfCanvas().fire(true);
    flushRaf();
    const draws = ctx2d.arc.mock.calls.length;
    expect(draws).toBeGreaterThan(0);

    ioOfCanvas().fire(false);
    flushRaf();
    expect(pendingRaf()).toBe(0);
    expect(ctx2d.arc.mock.calls.length).toBe(draws);

    // Plus aucun frame : cout CPU nul (shadowBlur x169 economise).
    flushRaf(2000);
    flushRaf(3000);
    expect(ctx2d.arc.mock.calls.length).toBe(draws);
  });

  it("(c) stoppe l'animation quand l'onglet est masque", () => {
    renderParticles();
    ioOfCanvas().fire(true);
    flushRaf();
    const draws = ctx2d.arc.mock.calls.length;
    expect(draws).toBeGreaterThan(0);

    setHidden(true, document);
    flushRaf();
    expect(pendingRaf()).toBe(0);
    expect(ctx2d.arc.mock.calls.length).toBe(draws);
  });

  it("(d) reprend l'animation au retour en champ et a la visibilite", () => {
    renderParticles();
    ioOfCanvas().fire(true);
    flushRaf();
    const draws = ctx2d.arc.mock.calls.length;

    ioOfCanvas().fire(false);
    flushRaf();
    expect(pendingRaf()).toBe(0);

    ioOfCanvas().fire(true);
    expect(pendingRaf()).toBe(1);
    flushRaf();
    expect(ctx2d.arc.mock.calls.length).toBeGreaterThan(draws);

    const draws2 = ctx2d.arc.mock.calls.length;
    setHidden(true, document);
    flushRaf();
    expect(pendingRaf()).toBe(0);
    setHidden(false, document);
    expect(pendingRaf()).toBe(1);
    flushRaf();
    expect(ctx2d.arc.mock.calls.length).toBeGreaterThan(draws2);
  });

  it("(e) cleanup complet a l'unmount : rAF, IO, RO, listeners interactifs", () => {
    const docRemove = vi.spyOn(document, "removeEventListener");
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount, container } = renderParticles();
    ioOfCanvas().fire(true);
    flushRaf();
    expect(ctx2d.arc).toHaveBeenCalled();

    const section = container.querySelector("section") as HTMLElement;
    const sectionRemove = vi.spyOn(section, "removeEventListener");

    unmount();

    expect(ioOfCanvas().disconnected).toBe(true);
    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0].disconnected).toBe(true);
    expect(docRemove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(cancelSpy).toHaveBeenCalled();
    // Listeners interactifs (pointermove/touchmove sur la section).
    expect(sectionRemove).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(sectionRemove).toHaveBeenCalledWith("touchmove", expect.any(Function));
    expect(pendingRaf()).toBe(0);

    const draws = ctx2d.arc.mock.calls.length;
    flushRaf(5000);
    expect(ctx2d.arc.mock.calls.length).toBe(draws);
  });

  it("(f) reduced-motion : 1 frame statique + ResizeObserver actif", () => {
    rmState.value = true;
    renderParticles();

    // 1 frame statique, aucune boucle.
    expect(ctx2d.arc).toHaveBeenCalled();
    expect(pendingRaf()).toBe(0);
    const draws = ctx2d.arc.mock.calls.length;

    // Le ResizeObserver reste monte (deja le cas avant LOT 39).
    expect(MockResizeObserver.instances).toHaveLength(1);
    const ro = MockResizeObserver.instances[0];
    expect(ro.elements.length).toBeGreaterThan(0);
    expect(ro.disconnected).toBe(false);

    // Redimensionnement : canvas retaille + frame statique redessinee.
    ro.fire();
    expect(ctx2d.arc.mock.calls.length).toBeGreaterThan(draws);
    expect(pendingRaf()).toBe(0);
  });

  it("(g) le ResizeObserver reconstruit les particules au redimensionnement", () => {
    const { container } = renderParticles();
    ioOfCanvas().fire(true);
    flushRaf();
    expect(ctx2d.arc).toHaveBeenCalled();

    // Vrai redimensionnement : le canvas est retaille (rebuild particules).
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    const before = canvas.width;
    const parent = canvas.parentElement as HTMLElement;
    Object.defineProperty(parent, "clientWidth", { configurable: true, value: 321 });
    Object.defineProperty(parent, "clientHeight", { configurable: true, value: 654 });
    MockResizeObserver.instances[0].fire();
    expect(canvas.width).not.toBe(before);

    // La boucle continue derriere (aucun restart, aucun doublon).
    expect(pendingRaf()).toBe(1);
    const draws = ctx2d.arc.mock.calls.length;
    flushRaf();
    expect(ctx2d.arc.mock.calls.length).toBeGreaterThan(draws);
  });
});
