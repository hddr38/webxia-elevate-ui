import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useLocale } from "@/lib/locale-context";
import {
  CAL_BG_DARK,
  CAL_BG_EMPHASIS_DARK,
  CAL_BG_EMPHASIS_LIGHT,
  CAL_BG_LIGHT,
  CAL_BG_MUTED_DARK,
  CAL_BG_MUTED_LIGHT,
  CAL_BG_SUBTLE_DARK,
  CAL_BG_SUBTLE_LIGHT,
  CAL_BOOKING_BASE_URL,
  CAL_BORDER_BOOKER_WIDTH,
  CAL_BRAND_DARK,
  CAL_BRAND_LIGHT,
  CAL_EMBED_JS_URL,
  CAL_EVENT_TYPE,
  CAL_NAMESPACE,
  CAL_ORIGIN,
  CAL_USERNAME,
} from "@/lib/constants";

interface BookingCalendarProps {
  username?: string;
  eventType?: string;
}

// Signature du snippet officiel Cal.com : les appels sont mis en queue jusqu'au
// chargement du bundle, puis rejoués. `loaded` / `q` / `ns` sont gérés par le stub.
type CalFn = ((...args: [string, ...unknown[]]) => void) & {
  loaded?: boolean;
  q?: IArguments[];
  ns?: Record<string, CalFn>;
  config?: Record<string, unknown>;
};

type CalWindow = Window & {
  Cal?: CalFn;
};

const CAL_SCRIPT_ID = "webxia-cal-embed-js";
// Bundle + rendu de l'iframe : prévoir large. L'échec franc (adblock, réseau)
// passe par `onerror` et bascule en fallback sans attendre ce délai.
const INIT_TIMEOUT_MS = 10000;

// Snippet officiel Cal.com porté en TS. window.Cal DOIT exister avant embed.js :
// le bundle lève "Cal is not defined" sans ce stub, donc un <script src>
// direct ne fonctionne pas. Le stub définit window.Cal de façon synchrone,
// met les appels en queue et charge embed.js une seule fois en arrière-plan.
function ensureCalStub(onScriptError: () => void): void {
  if (typeof window === "undefined") return;
  const w = window as CalWindow;
  if (typeof w.Cal === "function" && w.Cal.loaded) return;

  const enqueue = (target: CalFn, ar: IArguments) => {
    target.q = target.q || [];
    target.q.push(ar);
  };

  const stub = function (this: unknown) {
    // eslint-disable-next-line prefer-rest-params
    const ar = arguments;
    const cal = w.Cal as CalFn;
    if (!cal.loaded) {
      cal.ns = {};
      cal.q = cal.q || [];
      const d = window.document;
      if (!d.getElementById(CAL_SCRIPT_ID)) {
        const script = d.createElement("script");
        script.id = CAL_SCRIPT_ID;
        script.src = CAL_EMBED_JS_URL;
        script.async = true;
        script.onerror = () => onScriptError();
        d.head.appendChild(script);
      }
      cal.loaded = true;
    }
    if (ar[0] === "init" && typeof ar[1] === "string") {
      const namespace = ar[1];
      const api = function (this: unknown) {
        // eslint-disable-next-line prefer-rest-params
        enqueue(api, arguments);
      } as CalFn;
      cal.ns = cal.ns || {};
      cal.ns[namespace] = cal.ns[namespace] || api;
      enqueue(cal.ns[namespace], ar);
      enqueue(cal, ["initNamespace", namespace] as unknown as IArguments);
      return;
    }
    enqueue(cal, ar);
  } as CalFn;

  w.Cal = w.Cal || stub;
}

export function BookingCalendar({
  username = CAL_USERNAME,
  eventType = CAL_EVENT_TYPE,
}: BookingCalendarProps) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Toujours la valeur courante : l'init utilise le thème au moment du clic.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  // Thème effectivement appliqué à l'iframe (figé à sa création).
  const appliedThemeRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const failedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const calLink = `${username}/${eventType}`;
  const bookingUrl = `${CAL_BOOKING_BASE_URL}/${calLink}?theme=${theme}`;

  const handleRetry = useCallback(() => {
    // Recharge le bundle à zéro (cas adblock désactivé entre-temps, tag en erreur).
    if (typeof document !== "undefined") {
      document.getElementById(CAL_SCRIPT_ID)?.remove();
    }
    if (typeof window !== "undefined") {
      const w = window as CalWindow;
      if (w.Cal) w.Cal.loaded = false;
    }
    initializedRef.current = null;
    readyRef.current = false;
    failedRef.current = false;
    setReady(false);
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);

  // Init de l'embed inline officiel (client-only, après click-to-load).
  // Les appels Cal sont mis en queue par le stub et rejoués quand le bundle
  // est prêt ; `ready` n'est posé que lorsque l'embed a vraiment injecté
  // du contenu dans le conteneur (MutationObserver).
  useEffect(() => {
    if (!loaded || typeof window === "undefined") return;
    let cancelled = false;
    // Copie locale pour le cleanup (la ref peut changer entre-temps).
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const markFailed = () => {
      if (cancelled || readyRef.current || failedRef.current) return;
      initializedRef.current = null;
      failedRef.current = true;
      setFailed(true);
    };

    const markReady = () => {
      if (cancelled || readyRef.current || failedRef.current) return;
      readyRef.current = true;
      setReady(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    timeoutRef.current = setTimeout(markFailed, INIT_TIMEOUT_MS);

    const observer = new MutationObserver(() => {
      if (containerEl.childElementCount > 0) {
        observer.disconnect();
        markReady();
      }
    });
    observer.observe(containerEl, { childList: true, subtree: true });

    try {
      ensureCalStub(markFailed);
      const w = window as CalWindow;
      // Transmet ?name= / ?email= de l'URL vers le formulaire (snippet Cal).
      if (w.Cal) {
        w.Cal.config = w.Cal.config || {};
        w.Cal.config.forwardQueryParams = true;
      }

      // Évite le double init StrictMode + re-init si le lien change.
      // Thème forcé au thème du site (toggle dark/light), pas "auto" (OS),
      // pour rester cohérent avec le reste du site.
      if (initializedRef.current !== calLink) {
        initializedRef.current = calLink;
        appliedThemeRef.current = themeRef.current;
        // L'init crée l'entrée du namespace de façon synchrone dans le stub.
        w.Cal?.("init", CAL_NAMESPACE, { origin: CAL_ORIGIN });
        w.Cal?.ns?.[CAL_NAMESPACE]?.("inline", {
          elementOrSelector: containerEl,
          calLink,
          config: {
            layout: "month_view",
            useSlotsViewOnSmallScreen: "true",
            theme: themeRef.current,
          },
        });
      }
      w.Cal?.ns?.[CAL_NAMESPACE]?.("ui", {
        cssVarsPerTheme: {
          light: {
            "cal-brand": CAL_BRAND_LIGHT,
            "cal-bg": CAL_BG_LIGHT,
            "cal-bg-subtle": CAL_BG_SUBTLE_LIGHT,
            "cal-bg-emphasis": CAL_BG_EMPHASIS_LIGHT,
            "cal-bg-muted": CAL_BG_MUTED_LIGHT,
            "cal-border-booker-width": CAL_BORDER_BOOKER_WIDTH,
          },
          dark: {
            "cal-brand": CAL_BRAND_DARK,
            "cal-bg": CAL_BG_DARK,
            "cal-bg-subtle": CAL_BG_SUBTLE_DARK,
            "cal-bg-emphasis": CAL_BG_EMPHASIS_DARK,
            "cal-bg-muted": CAL_BG_MUTED_DARK,
            "cal-border-booker-width": CAL_BORDER_BOOKER_WIDTH,
          },
        },
        // Fond du <body> de l'iframe (derrière/autour du calendrier) : sans
        // ça, il reste blanc en mode sombre. Suit le toggle via le re-inline.
        styles: {
          body: {
            background: themeRef.current === "dark" ? CAL_BG_DARK : CAL_BG_LIGHT,
          },
        },
        hideEventTypeDetails: true,
        layout: "month_view",
        theme: themeRef.current,
      });
    } catch {
      markFailed();
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // StrictMode / navigation / retry : l'iframe est détruite avec le
      // conteneur, la prochaine montée réinitialise l'inline proprement.
      initializedRef.current = null;
      containerEl.innerHTML = "";
    };
  }, [loaded, calLink, attempt]);

  // Le thème est figé à la création de l'iframe : l'instruction `ui` ne
  // re-thème pas en direct. Au toggle, on recharge l'inline avec le nouveau
  // thème (l'effet d'init réutilisé affiche le loader entre-temps).
  // `appliedThemeRef` évite toute boucle de re-rendus.
  useEffect(() => {
    if (!loaded || !ready || failed || typeof window === "undefined") return;
    if (appliedThemeRef.current === theme) return;
    appliedThemeRef.current = theme;
    readyRef.current = false;
    failedRef.current = false;
    setReady(false);
    setAttempt((a) => a + 1);
  }, [theme, loaded, ready, failed]);

  return (
    <div className="h-full min-h-[480px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{t("booking.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("booking.subtitle")}</p>
        </div>
      </div>

      {loaded ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative min-h-[620px] md:min-h-[560px]">
            {!ready && !failed && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="size-6 animate-spin text-brand" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("booking.loading")}</p>
              </div>
            )}
            {failed ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
                <Calendar className="size-8 opacity-60" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("booking.fallback")}</p>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    {t("booking.retry")}
                  </button>
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {t("booking.openInNewTab")}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            ) : (
              <div
                ref={containerRef}
                id="webxia-cal-inline"
                className="h-full min-h-[620px] w-full overflow-auto md:min-h-[560px]"
                style={{ touchAction: "pan-y" }}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{t("booking.notice")}</p>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {t("booking.openInNewTab")}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="flex min-h-[420px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/40 p-6 text-center transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <Calendar className="size-8 opacity-60" aria-hidden="true" />
          <span className="font-medium">{t("booking.cta")}</span>
          <span className="text-xs text-muted-foreground">cal.com/{calLink}</span>
          <span className="max-w-sm text-xs text-muted-foreground">{t("booking.notice")}</span>
        </button>
      )}
    </div>
  );
}
