/**
 * DIAGNOSTIC TEMPORAIRE — branche `diagnostic/mobile-home` UNIQUEMENT.
 * Ne jamais merger dans main tel quel (outil d'isolation du jank mobile).
 *
 * Flags lus EXCLUSIVEMENT depuis l'URL (`?diag=...`), sans état persistant :
 * - aucun localStorage, aucun store global, aucune dépendance, aucun Sentry ;
 * - SSR-safe (garde `typeof window`, valeur par défaut = tout désactivé) ;
 * - sans `?diag=` (ou valeur inconnue / `baseline`) : tout est `false` et
 *   chaque appelant rend EXACTEMENT son JSX d'origine (pixel-perfect).
 * - chaque flag est indépendant ; `minimal` et `all-off` sont de simples
 *   combinaisons dérivées ici (aucun composant ne devine les autres flags).
 *
 * URLs de test : baseline | no-canvas | no-blobs | no-header-blur |
 * no-card-blur | no-animations | no-marquee | minimal | all-off
 *
 * Accès direct avec rechargement (les Links internes ne re-déclenchent pas
 * forcément une re-lecture) : `http://localhost:4173/?diag=no-blobs`.
 */
export interface DiagnosticFlags {
  /** Valeur brute de `?diag=` (`null` si absente). */
  diag: string | null;
  /** MatrixRain + ParticleField non rendus (mobile ET desktop). */
  noCanvas: boolean;
  /** Blobs blur + voiles/masques radiaux de la hero non rendus. */
  noBlobs: boolean;
  /** `backdrop-blur-xl` du header remplacé par fond opaque sur mobile. */
  noHeaderBlur: boolean;
  /** `backdrop-blur-md` des cartes remplacé par fond semi-opaque sur mobile. */
  noCardBlur: boolean;
  /** Animations Framer Motion / reveals neutralisés (contenu visible). */
  noAnimations: boolean;
  /** Marquee remplacée par une liste statique. */
  noMarquee: boolean;
  /** Hero texte simple + header sobre (voir table : chat widget exclu, cf. __root). */
  minimal: boolean;
  /** Tous les effets coûteux désactivés. */
  allOff: boolean;
}

const ALL_OFF: DiagnosticFlags = {
  diag: null,
  noCanvas: false,
  noBlobs: false,
  noHeaderBlur: false,
  noCardBlur: false,
  noAnimations: false,
  noMarquee: false,
  minimal: false,
  allOff: false,
};

/** Parseur pur (testable sans DOM). `search` = `window.location.search`. */
export function parseDiagnosticFlags(search: string): DiagnosticFlags {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get("diag");
  } catch {
    raw = null;
  }
  const base: DiagnosticFlags = { ...ALL_OFF, diag: raw };
  switch (raw) {
    case "no-canvas":
      return { ...base, noCanvas: true };
    case "no-blobs":
      return { ...base, noBlobs: true };
    case "no-header-blur":
      return { ...base, noHeaderBlur: true };
    case "no-card-blur":
      return { ...base, noCardBlur: true };
    case "no-animations":
      return { ...base, noAnimations: true };
    case "no-marquee":
      return { ...base, noMarquee: true };
    case "minimal":
      return {
        ...base,
        minimal: true,
        noCanvas: true,
        noBlobs: true,
        noHeaderBlur: true,
        noAnimations: true,
        noMarquee: true,
      };
    case "all-off":
      return {
        ...base,
        allOff: true,
        noCanvas: true,
        noBlobs: true,
        noHeaderBlur: true,
        noCardBlur: true,
        noAnimations: true,
        noMarquee: true,
      };
    default:
      // Absent, `baseline` ou inconnu → strictement identique à main.
      return base;
  }
}

/**
 * Lecture directe de l'URL à chaque rendu (pas d'état, pas de listener) :
 * le routeur re-rend les sections à chaque navigation, donc la valeur est
 * toujours fraîche après un accès direct `/?diag=...`.
 */
export function useDiagnosticFlags(): DiagnosticFlags {
  const search = typeof window === "undefined" ? "" : window.location.search;
  return parseDiagnosticFlags(search);
}
