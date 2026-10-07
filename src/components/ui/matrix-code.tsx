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
  fontSize = 18,
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    // QW-1 — gated rAF loop with fps clamp. Same cadence as before
    // (33/speed ms per frame), but driven by rAF timestamps and paused
    // whenever the hero is offscreen or the tab is hidden (CPU cost ≈ 0).
    const frameMs = 33 / speed;
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
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default MatrixRain;
