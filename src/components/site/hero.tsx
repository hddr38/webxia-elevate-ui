import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { ExpertiseMarquee } from "@/components/site/expertise-marquee";

export function Hero() {
  const { t } = useLocale();

  return (
    <section className="relative isolate overflow-hidden pt-28 pb-12 md:pb-16">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      <div className="absolute inset-0 -z-10 bg-radial-fade" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[160px]" />
      <div className="pointer-events-none absolute right-0 top-40 -z-10 size-[420px] rounded-full bg-accent/20 blur-[140px] animate-float-slow" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
            <Sparkles className="size-3.5 text-brand" />
            {t("hero.eyebrow")}
          </span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-7xl lg:text-[88px] lg:leading-[0.95]"
          >
            <span className="text-gradient-brand">{t("hero.title")}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-8 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Button variant="hero" size="xl" asChild>
              <Link to="/contact">
                {t("hero.primary")} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="glass" size="xl" asChild>
              <Link to="/work">{t("hero.secondary")}</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Expertises marquee */}
        <ExpertiseMarquee />
      </div>
    </section>
  );
}
