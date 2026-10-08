import { useEffect, useRef, type FC } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

interface MatrixRainProps {
  fontSize?: number;
  /** Explicit glyph color. Defaults to the resolved `--brand` theme variable. */
  color?: string;
  characters?: string;
  fadeOpacity?: number;
  speed?: number;
  className?: string;
}

const FALLBACK_COLOR = "#00ff00";

/**
 * Canvas `fillStyle` does not resolve CSS `var()` references, so the theme
 * variable is read from the computed styles with a matrix-green fallback.
 */
function resolveThemeColor(variable: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

const MatrixRain: FC<MatrixRainProps> = ({
  fontSize = 22,
  color,
  characters = "01",
  fadeOpacity = 0.12,
  speed = 0.8,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resolvedColor = color ?? resolveThemeColor("--brand", FALLBACK_COLOR);
    const chars = characters.split("");
    let drops: number[] = [];

    // QW-5 — only reassign the backing-store size when it actually changes.
    // Reassigning canvas.width/height clears the canvas and would force a
    // re-randomisation of the drops, so the initial ResizeObserver callback
    // (which always fires on observe()) becomes a harmless no-op.
    let lastColumnCount = 0;
    const sizeCanvas = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? window.innerWidth;
      const height = parent?.clientHeight ?? window.innerHeight;
      // LOT 41 P1 — DPR cap adaptatif : 1.5 sur mobile (< 768 px), 2 sur
      // desktop. La matrix est un fond decoratif flou : -44 % de pixels sur
      // iPhone (DPR 3 -> 1.5 vs 2), invisible a l'oeil.
      const viewportWidth = window.innerWidth || width;
      const dprCap = viewportWidth < 768 ? 1.5 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      // Cap DPR to keep the animation cheap on retina screens.
      const newW = Math.max(1, Math.floor(width * dpr));
      const newH = Math.max(1, Math.floor(height * dpr));
      const columnCount = Math.max(1, Math.floor(width / fontSize));
      if (canvas.width === newW && canvas.height === newH && columnCount === lastColumnCount) {
        return;
      }
      canvas.width = newW;
      canvas.height = newH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      lastColumnCount = columnCount;
      drops = Array.from({ length: columnCount }, () => Math.random() * -100);
    };

    sizeCanvas();

    const draw = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;

      // LOT 41 P1 — fade trail en une seule passe fillRect, sans shadowBlur
      // (jamais utilise sur la matrix : trop couteux sur iOS).
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeOpacity})`;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = resolvedColor;
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += speed;
      }
    };

    // QW-4 — the ResizeObserver is mounted BEFORE the reduced-motion
    // early return, so the canvas keeps following rotation/resize even when
    // the animation itself is disabled (1 static frame, redrawn on resize
    // because reassigning width/height clears the canvas).
    const resizeObserver = new ResizeObserver(() => {
      sizeCanvas();
      if (reduceMotion) draw();
    });
    const resizeParent = canvas.parentElement;
    if (resizeParent) {
      resizeObserver.observe(resizeParent);
    } else {
      window.addEventListener("resize", sizeCanvas);
    }

    // Reduced motion: render a single static frame instead of animating.
    if (reduceMotion) {
      draw();
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", sizeCanvas);
      };
    }

    // QW-1 — gated rAF loop with fps clamp, driven by rAF timestamps and
    // paused whenever the hero is offscreen or the tab is hidden (CPU cost
    // ≈ 0). LOT 41 P1 — cadence reduite a ~15 fps (66 ms) : -45 % de frames
    // vs ~27 fps avant (33/speed). Chute plus lente/zen, divise le cout
    // main-thread par ~2.7 cumule au DPR cap + fontSize 22.
    const frameMs = 66;
    let rafId = 0;
    let ticking = false;
    let lastFrame = 0; // rAF timestamp of the last drawn frame
    let inView = true; // IntersectionObserver state (default: running)

    const tick = (now: number) => {
      ticking = false;
      // Skip everything while offscreen or the tab is hidden.
      if (!inView || document.hidden) return;
      if (lastFrame === 0) {
        lastFrame = now;
        draw();
      } else if (now - lastFrame >= frameMs) {
        // Keep the fractional remainder so the perceived speed is unchanged.
        lastFrame = now - ((now - lastFrame) % frameMs);
        draw();
      }
      rafId = requestAnimationFrame(tick);
      ticking = true;
    };

    const kick = () => {
      if (!ticking && inView && !document.hidden) {
        rafId = requestAnimationFrame(tick);
        ticking = true;
      }
    };

    let inViewTimeout: number | NodeJS.Timeout = 0;
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const shouldBeInView = entries[0]?.isIntersecting ?? true;
        clearTimeout(inViewTimeout);
        inViewTimeout = setTimeout(() => {
          // LOT 41 — reset lastFrame a la reprise pour dessiner des la
          // prochaine frame (evite un trou visuel + rend les tests
          // deterministes avec le fps clamp 66 ms).
          if (shouldBeInView && !inView) lastFrame = 0;
          inView = shouldBeInView;
          if (inView) {
            kick();
          }
        }, 150);
      },
      { threshold: 0, rootMargin: "200px" },
    );
    intersectionObserver.observe(canvas.closest("section") ?? canvas);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        lastFrame = 0;
        kick();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    kick();

    return () => {
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", sizeCanvas);
      if (ticking) cancelAnimationFrame(rafId);
      clearTimeout(inViewTimeout);
    };
  }, [fontSize, color, characters, fadeOpacity, speed, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      style={{
        width: "100%",
        height: "100%",
        // LOT 41 P1 — isolation GPU + ceinture-bretelles pointer-events :
        // Safari iOS peint le canvas sur sa propre couche composite (pas de
        // recomposition du viewport par frame) et les taps traversent.
        willChange: "transform",
        transform: "translateZ(0)",
        contain: "strict",
        pointerEvents: "none",
      }}
    />
  );
};

export default MatrixRain;
