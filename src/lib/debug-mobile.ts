/**
 * LOT 43 Phase 8 — mode debug mobile (`?debug=1`).
 *
 * Inactif par defaut : ne fait RIEN sans `?debug=1` dans l'URL (0 cout prod).
 * Avec `?debug=1` : loggue les reperes temporels (init, 1er rAF, load),
 * compte les frames rAF sur 3 s (detecte les boucles JS continues), tick
 * d'intervalle toutes les 500 ms et evenements tactiles.
 *
 * Usage : ouvrir https://webxia-fr.netlify.app/?debug=1 sur iPhone, brancher
 * Safari Web Inspector (Mac) ou capturer la console, puis partager les logs.
 */
export function initMobileDebug(): void {
  if (typeof window === "undefined") return;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  if (params.get("debug") !== "1") return;

  const t0 = performance.now();
  const log = (label: string) => {
    const t = (performance.now() - t0).toFixed(0);
    console.log(`[DEBUG ${t}ms] ${label}`);
  };

  log("init");

  // Log au 1er paint (1er rAF).
  requestAnimationFrame(() => log("first rAF"));

  // Log apres hydratation/ressources.
  window.addEventListener("load", () => log("load event"));

  // Detecter les rAF actifs (frame par frame pendant 3 s) : un total proche
  // de 180 = une boucle continue tourne (canvas, framer-motion, marquee JS).
  let frames = 0;
  const loop = () => {
    frames++;
    if (performance.now() - t0 < 3000) {
      requestAnimationFrame(loop);
    } else {
      log(`total rAF: ${frames} in 3s`);
    }
  };
  requestAnimationFrame(loop);

  // Compter les timers actifs toutes les 500 ms.
  const intervalId = window.setInterval(() => {
    log("interval tick");
    if (performance.now() - t0 >= 3000) window.clearInterval(intervalId);
  }, 500);

  // Log des evenements tactiles (le tap arrive-t-il au document ?).
  document.addEventListener("touchstart", () => log("touchstart"), { passive: true });
  document.addEventListener("touchend", () => log("touchend"), { passive: true });

  log("debug ready - wait 3s and check console");
}
