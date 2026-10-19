/**
 * Constantes centralisées du widget chat Webi.
 *
 * - STICKY_SCROLL_THRESHOLD_PX : distance (px) au bas du conteneur en
 *   dessous de laquelle l'utilisateur est considéré "proche du bas".
 *   Utilisée par `isNearBottom` / `useStickyScroll`.
 * - MOBILE_BREAKPOINT_PX : breakpoint mobile du chat (px). Cohérent avec
 *   le breakpoint `md` de Tailwind (768px) : mobile = largeur < 768px
 *   (`max-md:` en Tailwind).
 */

export const STICKY_SCROLL_THRESHOLD_PX = 100;

export const MOBILE_BREAKPOINT_PX = 768;
