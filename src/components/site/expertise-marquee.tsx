"use client";

import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
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
import { useEffect, useRef, useState } from "react";
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
const duration = singleRowWidth / pixelsPerSecond;

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
  const [tabVisible, setTabVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);

  const paused = userPaused || hoverPaused || !isVisible || !tabVisible;

  const animate = (timestamp: number) => {
    if (isAnimatingRef.current) {
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      const newProgress = (progress.get() + delta / duration) % 1;
      progress.set(newProgress);
    }
    rafRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    lastTimeRef.current = performance.now();
    isAnimatingRef.current = !reduceMotion;
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      isAnimatingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // animate only reads isAnimatingRef (ref) and progress (stable MotionValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      isAnimatingRef.current = false;
      return;
    }
    if (paused) {
      isAnimatingRef.current = false;
    } else {
      lastTimeRef.current = performance.now();
      isAnimatingRef.current = true;
    }
  }, [paused, reduceMotion]);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
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

  const x = useTransform(progress, [0, 1], [0, -singleRowWidth]);

  return (
    <motion.div
      ref={containerRef}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
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
          <motion.div
            style={{ x: reduceMotion ? 0 : x, width: singleRowWidth * 2 + gap }}
            className="flex gap-4 overflow-visible py-8 will-change-transform"
            role="list"
            aria-label={t("services.eyebrow")}
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
          </motion.div>
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
