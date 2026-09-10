/**
 * Constantes centralisées du widget chat Webi.
 *
 * - STICKY_SCROLL_THRESHOLD_PX : distance (px) au bas du conteneur en
 *   dessous de laquelle l'utilisateur est considéré "proche du bas".
 *   Utilisée par `isNearBottom` / `useStickyScroll`.
 * - MOBILE_BREAKPOINT_PX : breakpoint mobile du chat (px). Cohérent avec
 *   le breakpoint `md` de Tailwind (768px) et le hook `useIsMobile`
 *   existant : mobile = largeur < 768px (`max-md:` en Tailwind).
 * - CHAT_DESKTOP_Z / CHAT_FULLSCREEN_Z : le site hôte plafonne à z-50
 *   (header fixe, dialogs Radix, sidebar admin, widget desktop). Le mode
 *   plein écran mobile passe à z-[60] pour rester au-dessus de tout
 *   overlay existant, sans valeur arbitraire plus haute.
 */

export const STICKY_SCROLL_THRESHOLD_PX = 100;

export const MOBILE_BREAKPOINT_PX = 768;

/** z-index desktop du widget (classe Tailwind `z-50` préservée). */
export const CHAT_DESKTOP_Z = 50;

/** z-index plein écran mobile : juste au-dessus du max site (z-50). */
export const CHAT_FULLSCREEN_Z = 60;
