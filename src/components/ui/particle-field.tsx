import { useEffect, useRef, type FC } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

interface ParticleFieldProps {
  className?: string;
  /** Nombre de particules par côté (total = n²). Défaut 13 → ~169 points. */
  particleCount?: number;
  /** Active le suivi souris/tactile. Défaut true. */
  interactive?: boolean;
}

// Charte WebXIA light : brand bleu #1D4ED8, accent violet #9333EA.
const BRAND_RGB: [number, number, number] = [29, 78, 216];
const ACCENT_RGB: [number, number, number] = [147, 51, 234];

interface Particle {
  /** Position de repos dans le repère du canvas (px). */
  bx: number;
  by: number;
  /** Position affichée (avec inertie). */
  x: number;
  y: number;
  scale: number;
  alpha: number;
  radius: number;
  dampening: number;
  color: string;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(t: number): string {
  const r = Math.round(mix(BRAND_RGB[0], ACCENT_RGB[0], t));
  const g = Math.round(mix(BRAND_RGB[1], ACCENT_RGB[1], t));
  const b = Math.round(mix(BRAND_RGB[2], ACCENT_RGB[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Fond de particules canvas pour le Hero clair.
 * Réécriture performante du snippet `ParticleHero` : 1 canvas + rAF batché,
 * au lieu de N divs + setTimeout par particule. Écoute le hover sur la
 * section parente (le canvas est en `pointer-events-none`).
 */
const ParticleField: FC<ParticleFieldProps> = ({
  className,
  particleCount = 13,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rows = Math.max(4, Math.min(24, Math.round(particleCount)));
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;

    const target = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    let isAutoMode = true;
    let lastMove = 0;
    let staticTimer: ReturnType<typeof setTimeout> | undefined;
    let autoTimer: ReturnType<typeof setTimeout> | undefined;
    const startTime = Date.now();

    const buildParticles = (w: number, h: number) => {
      particles = [];
      const gap = Math.min(w, h) / (rows + 2);
      const cx = w / 2;
      const cy = h / 2;
      const maxDist = Math.sqrt(2) * ((rows - 1) / 2);
      const center = (rows - 1) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < rows; col++) {
          const dist = Math.sqrt((row - center) ** 2 + (col - center) ** 2);
          const t = maxDist === 0 ? 0 : dist / maxDist;
          const bx = cx + (col - center) * gap;
          const by = cy + (row - center) * gap;
          particles.push({
            bx,
            by,
            x: bx,
            y: by,
            scale: Math.max(0.35, 1.25 - dist * 0.14),
            alpha: Math.max(0.1, 0.55 - dist * 0.045),
            radius: Math.max(1, 2.6 - dist * 0.14),
            dampening: Math.max(0.25, 1 - dist * 0.09),
            color: mixColor(t),
          });
        }
      }
    };

    const sizeCanvas = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles(w, h);
    };

    sizeCanvas();

    const drawFrame = (cursorX: number, cursorY: number) => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const px = p.bx + cursorX * p.dampening;
        const py = p.by + cursorY * p.dampening;
        p.x += (px - p.x) * 0.12;
        p.y += (py - p.y) * 0.12;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8 * p.scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    // Reduced motion : une frame statique, pas de boucle.
    if (reduceMotion) {
      drawFrame(0, 0);
      const observer = new ResizeObserver(() => {
        sizeCanvas();
        drawFrame(0, 0);
      });
      if (canvas.parentElement) observer.observe(canvas.parentElement);
      return () => observer.disconnect();
    }

    const tick = () => {
      if (!running) return;
      const t = (Date.now() - startTime) * 0.001;
      if (isAutoMode) {
        target.x = Math.sin(t * 0.3) * 110 + Math.sin(t * 0.17) * 55;
        target.y = Math.cos(t * 0.2) * 80 + Math.cos(t * 0.23) * 45;
      } else if (lastMove > 0 && Date.now() - lastMove > 500) {
        // Dérive subtile autour du point figé (handover manuel → statique).
        const strength = Math.min((Date.now() - lastMove - 500) / 1000, 1);
        const baseX = target.x;
        const baseY = target.y;
        smooth.x = baseX + Math.sin(t * 1.5) * 14 * strength;
        smooth.y = baseY + Math.cos(t * 1.2) * 11 * strength;
        drawFrame(smooth.x, smooth.y);
        raf = requestAnimationFrame(tick);
        return;
      }
      smooth.x += (target.x - smooth.x) * 0.08;
      smooth.y += (target.y - smooth.y) * 0.08;
      drawFrame(smooth.x, smooth.y);
      raf = requestAnimationFrame(tick);
    };

    const handleMove = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      target.x = (clientX - cx) * 0.35;
      target.y = (clientY - cy) * 0.35;
      isAutoMode = false;
      lastMove = Date.now();
      if (staticTimer) clearTimeout(staticTimer);
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (Date.now() - lastMove >= 3900) isAutoMode = true;
      }, 4000);
    };

    const onPointerMove = (e: PointerEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) handleMove(touch.clientX, touch.clientY);
    };

    let interactiveTarget: HTMLElement | Window = window;
    if (interactive) {
      // Le canvas est pointer-events-none : on écoute la section parente.
      const section = canvas.closest("section") ?? canvas.parentElement;
      interactiveTarget = section ?? window;
      interactiveTarget.addEventListener("pointermove", onPointerMove as EventListener, {
        passive: true,
      });
      interactiveTarget.addEventListener("touchmove", onTouchMove as EventListener, {
        passive: true,
      });
    }

    const observer = new ResizeObserver(sizeCanvas);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (staticTimer) clearTimeout(staticTimer);
      if (autoTimer) clearTimeout(autoTimer);
      interactiveTarget.removeEventListener("pointermove", onPointerMove as EventListener);
      interactiveTarget.removeEventListener("touchmove", onTouchMove as EventListener);
    };
  }, [particleCount, interactive, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default ParticleField;
