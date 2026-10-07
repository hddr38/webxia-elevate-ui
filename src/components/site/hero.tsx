import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import MatrixRain from "@/components/ui/matrix-code";
import ParticleField from "@/components/ui/particle-field";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";
import { ExpertiseMarquee } from "@/components/site/expertise-marquee";

export function Hero() {
  const { t } = useLocale();
  const { theme } = useTheme();
  // LOT 39 P3 (QW-7) — canvas monte cote client uniquement (bug B-3).
  // Le SSR servait toujours MatrixRain (theme initial "dark") puis
  // l'hydratation basculait vers ParticleField sur device clair
  // (demontage + remontage = double initialisation). Ici le SSR ne rend
  // aucun <canvas> ; le premier commit client non plus (mounted=false),
  // donc pas de mismatch d'hydratation. Les wrappers gardent dimensions
  // et position exactes (absolute inset-0, canvas decoratif) → CLS = 0.
  // Les setState des effets passifs sont batche (mounted + theme resolu),
  // le canvas monte UNE fois, directement dans la bonne variante.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative isolate overflow-hidden pt-28 pb-12 md:pb-16">
      {/* Background */}
      {theme === "dark" ? (
        <>
          {mounted && (
            <MatrixRain
              className="absolute inset-0 -z-10 opacity-60"
              characters="01"
              fontSize={16}
              fadeOpacity={0.08}
              speed={0.9}
            />
          )}
          {/* Readability veil: keeps the centered title legible over the rain */}
          <div className="absolute inset-0 -z-10 bg-background/70 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,black,transparent)]" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
          {mounted && (
            <ParticleField
              className="absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]"
              particleCount={13}
            />
          )}
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-radial-fade" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-40 -z-10 size-[360px] rounded-full bg-accent/20 blur-[120px] animate-float-slow" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          // LOT 33 — visible des le SSR (LCP) : le conteneur etait aussi
          // opacity:0 en SSR, corriger le seul h1 n'aurait pas suffi.
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
            <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
            {t("hero.eyebrow")}
          </span>

          <motion.h1
            // LOT 33 — le h1 est l'element LCP : visible des le SSR.
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-7xl lg:text-[88px] lg:leading-[0.95]"
          >
            <span className="text-gradient-brand">{t("hero.title")}</span>
          </motion.h1>

          <motion.p
            // LOT 34 — visible des le SSR comme le h1 (LOT 33) : le sous-titre
            // partait de opacity:0 et poppait apres hydratation (flash).
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-8 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            // LOT 34 — meme chose pour les CTA : visibles des le SSR.
            initial={false}
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
