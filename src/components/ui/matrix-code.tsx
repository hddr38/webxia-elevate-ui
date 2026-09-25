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

    const sizeCanvas = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? window.innerWidth;
      const height = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Cap DPR to keep the animation cheap on retina screens.
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const columnCount = Math.max(1, Math.floor(width / fontSize));
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

    // Reduced motion: render a single static frame instead of animating.
    if (reduceMotion) {
      draw();
      return;
    }

    const interval = window.setInterval(draw, 33 / speed);

    const observer = new ResizeObserver(sizeCanvas);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", sizeCanvas);
    }

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("resize", sizeCanvas);
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
