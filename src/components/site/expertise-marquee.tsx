"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const marqueeKeys = [
  { icon: "🌐", titleKey: "expertises.marquee.1.title" as const, descKey: "expertises.marquee.1.desc" as const },
  { icon: "🎨", titleKey: "expertises.marquee.2.title" as const, descKey: "expertises.marquee.2.desc" as const },
  { icon: "📈", titleKey: "expertises.marquee.3.title" as const, descKey: "expertises.marquee.3.desc" as const },
  { icon: "🤖", titleKey: "expertises.marquee.4.title" as const, descKey: "expertises.marquee.4.desc" as const },
  { icon: "⚙️", titleKey: "expertises.marquee.5.title" as const, descKey: "expertises.marquee.5.desc" as const },
  { icon: "🔧", titleKey: "expertises.marquee.6.title" as const, descKey: "expertises.marquee.6.desc" as const },
];

const itemWidth = 280;
const gap = 16;
const totalItems = marqueeKeys.length;
const singleRowWidth = totalItems * itemWidth + (totalItems - 1) * gap;
const pixelsPerSecond = 35;
const duration = singleRowWidth / pixelsPerSecond;

export function ExpertiseMarquee() {
  const { t } = useLocale();
  const [isHovered, setIsHovered] = useState(false);
  const progress = useMotionValue(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);

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
    isAnimatingRef.current = true;
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      isAnimatingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // animate only reads isAnimatingRef (ref) and progress (stable MotionValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isHovered) {
      isAnimatingRef.current = false;
    } else {
      lastTimeRef.current = performance.now();
      isAnimatingRef.current = true;
    }
  }, [isHovered]);

  const x = useTransform(progress, [0, 1], [0, -singleRowWidth]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.55 }}
      className="mx-auto mt-16 w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <div className="relative">
        <div className="overflow-x-hidden">
          <motion.div
            style={{ x, width: singleRowWidth * 2 + gap }}
            className="flex gap-4 will-change-transform overflow-visible py-8"
            role="list"
            aria-label={t("services.eyebrow")}
          >
            {marqueeKeys.map((m, i) => (
              <motion.div
                key={`${m.titleKey}-${i}`}
                role="listitem"
                className="flex-shrink-0 w-[280px] bg-background/80 rounded-2xl border border-border p-5 text-center backdrop-blur-md relative z-10"
                whileHover={{ y: -4, scale: 1.02, zIndex: 20, transition: { duration: 0.3 } }}
              >
                <div className="text-3xl" aria-hidden="true">
                  {m.icon}
                </div>
                <div className="mt-2 font-display text-sm font-semibold tracking-tight">
                  {t(m.titleKey)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{t(m.descKey)}</div>
              </motion.div>
            ))}
            {marqueeKeys.map((m, i) => (
              <motion.div
                key={`${m.titleKey}-${i}-clone`}
                role="listitem"
                className="flex-shrink-0 w-[280px] bg-background/80 rounded-2xl border border-border p-5 text-center backdrop-blur-md relative z-10"
                whileHover={{ y: -4, scale: 1.02, zIndex: 20, transition: { duration: 0.3 } }}
              >
                <div className="text-3xl" aria-hidden="true">
                  {m.icon}
                </div>
                <div className="mt-2 font-display text-sm font-semibold tracking-tight">
                  {t(m.titleKey)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{t(m.descKey)}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
