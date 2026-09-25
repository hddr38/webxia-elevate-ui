import { describe, it, expect, vi, afterEach } from "vitest";
import { createRafGate, isNearBottom, subscribeViewportResize } from "./use-sticky-scroll";
import { MOBILE_BREAKPOINT_PX, STICKY_SCROLL_THRESHOLD_PX } from "@/components/chat/constants";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat constants", () => {
  it("centralise le seuil sticky à 100px", () => {
    expect(STICKY_SCROLL_THRESHOLD_PX).toBe(100);
  });

  it("centralise le breakpoint mobile à 768px (cohérent avec md: Tailwind)", () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(768);
  });
});

describe("isNearBottom", () => {
  it("vrai tout en bas (distance 0)", () => {
    // scrollHeight 1000, visible 500, scrollTop 500 → distance 0
    expect(isNearBottom(500, 1000, 500)).toBe(true);
  });

  it("vrai proche du bas (distance 50 <= 100)", () => {
    expect(isNearBottom(450, 1000, 500)).toBe(true);
  });

  it("vrai au seuil exact (distance 100 <= 100)", () => {
    expect(isNearBottom(400, 1000, 500)).toBe(true);
  });

  it("faux juste au-delà du seuil (distance 101 > 100)", () => {
    expect(isNearBottom(399, 1000, 500)).toBe(false);
  });

  it("faux au milieu de l'historique", () => {
    expect(isNearBottom(100, 1000, 500)).toBe(false);
  });

  it("faux tout en haut", () => {
    expect(isNearBottom(0, 1000, 500)).toBe(false);
  });

  it("vrai quand le contenu est plus court que le viewport", () => {
    // distance négative : déjà "en bas"
    expect(isNearBottom(0, 200, 500)).toBe(true);
  });

  it("respecte un seuil personnalisé (0 = bas exact uniquement)", () => {
    expect(isNearBottom(500, 1000, 500, 0)).toBe(true);
    expect(isNearBottom(499, 1000, 500, 0)).toBe(false);
  });

  it("respecte un seuil personnalisé élargi", () => {
    expect(isNearBottom(250, 1000, 500, 250)).toBe(true);
    expect(isNearBottom(249, 1000, 500, 250)).toBe(false);
  });
});

describe("createRafGate (throttle streaming : max 1 scroll / frame)", () => {
  function createFakeRaf(): {
    raf: (cb: () => void) => number;
    flush: () => void;
    queued: () => number;
  } {
    const queue: Array<() => void> = [];
    return {
      raf: (cb: () => void): number => {
        queue.push(cb);
        return queue.length;
      },
      flush: (): void => {
        const pending = [...queue];
        queue.length = 0;
        for (const fn of pending) fn();
      },
      queued: (): number => queue.length,
    };
  }

  it("coalesce plusieurs text_delta synchrones en un seul rAF", () => {
    const fake = createFakeRaf();
    const gate = createRafGate(fake.raf);
    const cb = vi.fn();

    gate.schedule(cb);
    gate.schedule(cb);
    gate.schedule(cb);

    expect(fake.queued()).toBe(1);
    expect(gate.isPending()).toBe(true);

    fake.flush();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(gate.isPending()).toBe(false);
  });

  it("autorise un nouveau scroll à la frame suivante", () => {
    const fake = createFakeRaf();
    const gate = createRafGate(fake.raf);
    const cb = vi.fn();

    gate.schedule(cb);
    fake.flush();
    gate.schedule(cb);
    fake.flush();

    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("subscribeViewportResize (clavier virtuel, visualViewport mocké)", () => {
  it("priorité à window.visualViewport quand disponible", () => {
    const onResize = vi.fn();
    const vvAdd = vi.fn();
    const vvRemove = vi.fn();
    const winAdd = vi.fn();
    const winRemove = vi.fn();
    vi.stubGlobal("window", {
      visualViewport: { addEventListener: vvAdd, removeEventListener: vvRemove },
      addEventListener: winAdd,
      removeEventListener: winRemove,
    });

    const unsubscribe = subscribeViewportResize(onResize);

    expect(vvAdd).toHaveBeenCalledTimes(1);
    expect(vvAdd.mock.calls[0]?.[0]).toBe("resize");
    expect(winAdd).not.toHaveBeenCalled();

    // Le resize du clavier déclenche le recalage.
    const listener = vvAdd.mock.calls[0]?.[1] as (() => void) | undefined;
    listener?.();
    expect(onResize).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(vvRemove).toHaveBeenCalledTimes(1);
  });

  it("fallback window resize quand visualViewport est indisponible", () => {
    const onResize = vi.fn();
    const winAdd = vi.fn();
    const winRemove = vi.fn();
    vi.stubGlobal("window", {
      visualViewport: null,
      addEventListener: winAdd,
      removeEventListener: winRemove,
    });

    const unsubscribe = subscribeViewportResize(onResize);

    expect(winAdd).toHaveBeenCalledTimes(1);
    expect(winAdd.mock.calls[0]?.[0]).toBe("resize");

    const listener = winAdd.mock.calls[0]?.[1] as (() => void) | undefined;
    listener?.();
    expect(onResize).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(winRemove).toHaveBeenCalledTimes(1);
  });

  it("noop sans window (SSR)", () => {
    const onResize = vi.fn();
    const unsubscribe = subscribeViewportResize(onResize);
    expect(() => unsubscribe()).not.toThrow();
    expect(onResize).not.toHaveBeenCalled();
  });
});
