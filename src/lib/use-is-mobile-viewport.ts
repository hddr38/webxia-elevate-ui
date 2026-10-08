import { useEffect, useState } from "react";

/** Seuil mobile LOT 42/43 : en dessous, pas de canvas ni d'animations JS. */
export const MOBILE_MAX_WIDTH_PX = 767;

/**
 * Detection mobile SSR-safe (matchMedia, jamais userAgent seul).
 * - SSR + 1er rendu client : `false` (identique au HTML servi -> pas d'erreur
 *   d'hydratation React #418 sur mobile ; SEO/LCP preserves).
 * - Apres mount : lecture matchMedia + ecoute `change` (rotation/zoom) et
 *   `resize`/`orientationchange` en secours (Safari < 14 : addListener).
 * - Complement tactile : si matchMedia est indisponible (vieux navigateurs),
 *   repli sur `innerWidth` (les tactiles modernes supportent matchMedia).
 */
export function useIsMobileViewport(breakpoint: number = MOBILE_MAX_WIDTH_PX): boolean {
  // Premier rendu (SSR + 1er rendu client) = `false`, identique au HTML servi
  // (canvas + contenu visible) : evite l'erreur d'hydratation React #418 sur
  // mobile. La bascule vers le mode mobile se fait dans l'effet ci-dessous,
  // avant tout rAF couteux (les canvas demontes nettoient leur boucle).
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = `(max-width: ${breakpoint}px)`;
    const mq = window.matchMedia(query);
    const read = (): boolean => {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return window.innerWidth <= breakpoint;
      }
    };
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    const onResize = () => setIsMobile(read());
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    onResize();
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [breakpoint]);

  return isMobile;
}
