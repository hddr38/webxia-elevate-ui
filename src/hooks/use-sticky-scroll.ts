"use client";

import * as React from "react";
import { STICKY_SCROLL_THRESHOLD_PX } from "@/components/chat/constants";

/**
 * Décision pure "l'utilisateur est-il proche du bas ?".
 * Testable sans layout réel : ne touche jamais au DOM.
 *
 * @param scrollTop - position verticale actuelle du scroll (px)
 * @param scrollHeight - hauteur totale du contenu (px)
 * @param clientHeight - hauteur visible du conteneur (px)
 * @param threshold - distance au bas tolérée (px, défaut 100)
 * @returns true si la distance au bas est <= threshold
 */
export function isNearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = STICKY_SCROLL_THRESHOLD_PX,
): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= threshold;
}

function readGeometry(el: HTMLDivElement): {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
} {
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  };
}

/**
 * Abonnement resize clavier virtuel, testable avec visualViewport mocké.
 * Priorité à `window.visualViewport` ("resize"), fallback `window` ("resize")
 * quand visualViewport est indisponible. Retourne la fonction de désabonnement.
 */
export function subscribeViewportResize(onResize: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
    };
  }
  window.addEventListener("resize", onResize);
  return () => {
    window.removeEventListener("resize", onResize);
  };
}

/**
 * Barrière rAF : coalesce N appels synchrones en 1 seul callback par frame.
 * Utilisée par le suivi streaming (maximum un scroll par frame).
 * Testable avec rAF mocké (le callback `raf` est injecté, défaut = global).
 */
export function createRafGate(
  raf: (cb: () => void) => number = (cb) => requestAnimationFrame(cb),
): { schedule: (cb: () => void) => void; isPending: () => boolean } {
  let pending = false;
  return {
    schedule: (cb: () => void): void => {
      if (pending) return;
      pending = true;
      raf(() => {
        pending = false;
        cb();
      });
    },
    isPending: (): boolean => pending,
  };
}

export interface UseStickyScrollReturn {
  /** Ref à poser sur le conteneur scrollable des messages. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** true si le suivi sticky est actif (proche du bas). */
  isSticky: boolean;
  /**
   * a) Envoi utilisateur : scroll FORCÉ, sans condition de proximité.
   * behavior 'smooth' (appel unique, pas de haute fréquence).
   */
  forceScrollToBottom: () => void;
  /**
   * b) Message entrant complet : scroll CONDITIONNEL (si proche du bas),
   * recalé en rAF après mise à jour du DOM (nouvelle hauteur prise en compte).
   */
  notifyMessageComplete: () => void;
  /**
   * c) Pendant le streaming (text_delta) : suivi sticky-bottom.
   * Si proche du bas → suit à chaque delta via rAF throttlé (max 1/frame),
   * behavior 'auto' (jamais de smooth répété). Si l'utilisateur a remonté,
   * ne fait rien ; la reprise se fait automatiquement à son retour près du bas.
   */
  notifyStreamingTick: () => void;
}

/**
 * Hook dédié à l'auto-scroll du chat (desktop + mobile), indépendant du composant.
 *
 * - Suit le scroll utilisateur en continu (listener `scroll`) pour activer /
 *   couper le mode sticky immédiatement, y compris pendant le streaming.
 * - Sur `resize` de `visualViewport` (clavier virtuel mobile) avec fallback
 *   `window resize` : si le mode sticky est actif, reste calé en bas pour que
 *   l'input demeure visible.
 */
export function useStickyScroll(): UseStickyScrollReturn {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const stickyRef = React.useRef<boolean>(true);
  const rafGateRef = React.useRef<ReturnType<typeof createRafGate> | null>(null);
  if (rafGateRef.current === null) {
    rafGateRef.current = createRafGate();
  }
  const [isSticky, setIsSticky] = React.useState<boolean>(true);

  const setSticky = React.useCallback((value: boolean) => {
    stickyRef.current = value;
    setIsSticky((prev) => (prev === value ? prev : value));
  }, []);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // --- a) Envoi utilisateur : scroll forcé, smooth, après insertion DOM ---
  const forceScrollToBottom = React.useCallback(() => {
    setSticky(true);
    requestAnimationFrame(() => {
      scrollToBottom("smooth");
    });
  }, [scrollToBottom, setSticky]);

  // --- b) Message complet : scroll conditionnel, recalé en rAF ---
  const notifyMessageComplete = React.useCallback(() => {
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = readGeometry(el);
      if (isNearBottom(scrollTop, scrollHeight, clientHeight)) {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      }
    });
  }, []);

  // --- c) Streaming : suivi throttlé à 1 scroll / frame, behavior auto ---
  const notifyStreamingTick = React.useCallback(() => {
    // Arrêt immédiat si l'utilisateur lit l'historique (seuil réévalué
    // en continu via le listener scroll, pas seulement à l'ajout).
    if (!stickyRef.current) return;
    const gate = rafGateRef.current;
    if (!gate) return;
    gate.schedule(() => {
      const el = containerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = readGeometry(el);
      if (isNearBottom(scrollTop, scrollHeight, clientHeight)) {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      } else {
        // L'utilisateur a remonté entre la planification et la frame.
        setSticky(false);
      }
    });
  }, [setSticky]);

  // Suivi continu de la proximité au bas (remontée → stop, retour → reprise).
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = readGeometry(el);
      setSticky(isNearBottom(scrollTop, scrollHeight, clientHeight));
    };
    // État initial : si l'historique est court, on est déjà en bas.
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [setSticky]);

  // Clavier virtuel : sur resize du visualViewport (fallback window resize),
  // l'input reste visible et le scroll reste calé en bas si sticky actif.
  React.useEffect(() => {
    const keepPinned = (): void => {
      if (!stickyRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    };
    return subscribeViewportResize(keepPinned);
  }, []);

  return {
    containerRef,
    isSticky,
    forceScrollToBottom,
    notifyMessageComplete,
    notifyStreamingTick,
  };
}
