"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Globe,
  Palette,
  Pause,
  Play,
  Shield,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "@/lib/locale-context";

const marqueeKeys: {
  icon: LucideIcon;
  titleKey:
    | "expertises.marquee.1.title"
    | "expertises.marquee.2.title"
    | "expertises.marquee.3.title"
    | "expertises.marquee.4.title"
    | "expertises.marquee.5.title"
    | "expertises.marquee.6.title";
  descKey:
    | "expertises.marquee.1.desc"
    | "expertises.marquee.2.desc"
    | "expertises.marquee.3.desc"
    | "expertises.marquee.4.desc"
    | "expertises.marquee.5.desc"
    | "expertises.marquee.6.desc";
}[] = [
  {
    icon: Globe,
    titleKey: "expertises.marquee.1.title" as const,
    descKey: "expertises.marquee.1.desc" as const,
  },
  {
    icon: Palette,
    titleKey: "expertises.marquee.2.title" as const,
    descKey: "expertises.marquee.2.desc" as const,
  },
  {
    icon: TrendingUp,
    titleKey: "expertises.marquee.3.title" as const,
    descKey: "expertises.marquee.3.desc" as const,
  },
  {
    icon: Bot,
    titleKey: "expertises.marquee.4.title" as const,
    descKey: "expertises.marquee.4.desc" as const,
  },
  {
    icon: Wrench,
    titleKey: "expertises.marquee.5.title" as const,
    descKey: "expertises.marquee.5.desc" as const,
  },
  {
    icon: Shield,
    titleKey: "expertises.marquee.6.title" as const,
    descKey: "expertises.marquee.6.desc" as const,
  },
];

const itemWidth = 280;
const gap = 16;
const totalItems = marqueeKeys.length;
const singleRowWidth = totalItems * itemWidth + (totalItems - 1) * gap;
const pixelsPerSecond = 35;
// LOT 34 — decalage d'une boucle seamless : largeur d'un bloc complet +
// le gap qui le suit (l'ancien pilotage rAF bouclait sur -singleRowWidth,
// soit un saut de 16px a chaque tour).
const marqueeShift = singleRowWidth + gap;
const duration = marqueeShift / pixelsPerSecond;

function MarqueeCard({
  icon: Icon,
  title,
  desc,
  hidden = false,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  hidden?: boolean;
}) {
  return (
    <motion.div
      role={hidden ? undefined : "listitem"}
      aria-hidden={hidden || undefined}
      className="relative z-10 w-[280px] flex-shrink-0 rounded-2xl border border-border bg-background/80 p-5 text-center"
      whileHover={{ y: -4, scale: 1.02, zIndex: 20, transition: { duration: 0.3 } }}
    >
      <div
        className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </div>
      <div className="mt-2 font-display text-sm font-semibold tracking-tight">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </motion.div>
  );
}

export function ExpertiseMarquee() {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  // LOT 34 — init a `true` pour coller au HTML SSR (sinon mismatch de style
  // hydration : le serveur ecrit running, le client paused, et rien ne
  // re-rend). La vraie valeur est synchro au montage dans l'effect ci-dessous.
  const [tabVisible, setTabVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // LOT 34 — le pilotage rAF + MotionValue est remplace par une animation CSS
  // (voir .marquee-track dans styles.css) : le compositor l'execute, le
  // main thread n'est plus sollicite frame par frame pendant le scroll.
  // Tous les etats de pause sont conserves et pilotent animation-play-state.
  const paused = userPaused || hoverPaused || !isVisible || !tabVisible;

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={containerRef}
      // LOT 34 — visible des le SSR (pas de pop-in differe apres hydratation).
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.55 }}
      className="mx-auto mt-16 w-full"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={() => setHoverPaused(true)}
      onBlur={() => setHoverPaused(false)}
      onTouchStart={() => setHoverPaused(true)}
      onTouchEnd={() => setHoverPaused(false)}
    >
      <div className="relative">
        <div className="overflow-x-hidden">
          <div
            role="list"
            aria-label={t("services.eyebrow")}
            className="marquee-track flex gap-4 overflow-visible py-8 will-change-transform"
            style={
              {
                width: singleRowWidth * 2 + gap,
                "--marquee-shift": `${marqueeShift}px`,
                "--marquee-duration": `${duration}s`,
                animation: reduceMotion ? "none" : undefined,
                animationPlayState: paused ? "paused" : "running",
              } as CSSProperties
            }
          >
            {marqueeKeys.map((m, i) => (
              <MarqueeCard
                key={`${m.titleKey}-${i}`}
                icon={m.icon}
                title={t(m.titleKey)}
                desc={t(m.descKey)}
              />
            ))}
            {marqueeKeys.map((m, i) => (
              <MarqueeCard
                key={`${m.titleKey}-${i}-clone`}
                icon={m.icon}
                title={t(m.titleKey)}
                desc={t(m.descKey)}
                hidden
              />
            ))}
          </div>
        </div>
        {!reduceMotion && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-pressed={userPaused}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
            >
              {userPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {userPaused ? t("marquee.play") : t("marquee.pause")}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
