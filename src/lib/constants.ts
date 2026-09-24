export const STATUS_LABELS: Record<string, string> = {
  all: "status.all",
  draft: "status.draft",
  published: "status.published",
  archived: "status.archived",
};

export const STATUS_BADGE: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300",
  published: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-500/15 dark:text-gray-300",
};

// Cal.com — lien de réservation affiché sur la page contact.
// Lien validé : cal.com/webxia/30min (ne pas modifier sans valider le compte Cal).
export const CAL_USERNAME = "webxia";
export const CAL_EVENT_TYPE = "30min";
export const CAL_LINK = `${CAL_USERNAME}/${CAL_EVENT_TYPE}`;
export const CAL_BOOKING_BASE_URL = "https://cal.com";
export const CAL_ORIGIN = "https://app.cal.com";
export const CAL_EMBED_JS_URL = "https://app.cal.com/embed/embed.js";
// Namespace généré par Cal.com pour cet embed (isole les instructions).
export const CAL_NAMESPACE = "30min";
// Couleurs de marque Cal (cssVarsPerTheme) — assorties à la charte du site.
export const CAL_BRAND_LIGHT = "#1D4ED8";
export const CAL_BRAND_DARK = "#4D7BF9";
// Fond de l'embed Cal (cssVarsPerTheme `cal-bg`) — fusion avec la carte du site.
// --card light = blanc, --card dark = oklch(0.21 0.014 260), cf. src/styles.css.
export const CAL_BG_LIGHT = "#FFFFFF";
export const CAL_BG_DARK = "oklch(0.21 0.014 260)";
// Famille de surfaces Cal — l'étape formulaire peint son fond avec `cal-bg-muted`
// et les survols/cartes avec `cal-bg-subtle`/`cal-bg-emphasis` : il faut mapper
// toute la famille aux tokens du site, sinon des aplats noirs Cal subsistent.
// Light : --surface / --muted / --card. Dark : --muted / --secondary / --surface.
export const CAL_BG_SUBTLE_LIGHT = "oklch(0.97 0.004 240)";
export const CAL_BG_SUBTLE_DARK = "oklch(0.24 0.016 260)";
export const CAL_BG_EMPHASIS_LIGHT = "oklch(0.96 0.005 240)";
export const CAL_BG_EMPHASIS_DARK = "oklch(0.26 0.018 260)";
export const CAL_BG_MUTED_LIGHT = "#FFFFFF";
export const CAL_BG_MUTED_DARK = "oklch(0.2 0.014 260)";
// Supprime la bordure externe du booker (le conteneur du site a déjà la sienne).
export const CAL_BORDER_BOOKER_WIDTH = "0px";
