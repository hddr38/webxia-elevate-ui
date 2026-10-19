import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import MatrixRain from "@/components/ui/matrix-code";
import ParticleField from "@/components/ui/particle-field";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";
import { ExpertiseMarquee } from "@/components/site/expertise-marquee";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";

// LOT 6.4-b V3 (Hero Canvas mobile) — kill-switch de rollback : permet de
// désactiver les canvas mobiles via une variable d'environnement Netlify
// (`VITE_ENABLE_MOBILE_CANVAS=false`) sans redéployer de code. Défaut : actif.
const MOBILE_CANVAS_ENABLED = import.meta.env.VITE_ENABLE_MOBILE_CANVAS !== "false";

export function Hero() {
  const { t } = useLocale();
  const { theme } = useTheme();
  // LOT 6.4-b V3 — les canvas sont réactivés sur mobile avec des params allégés
  // (DPR 1.0, fontSize/particleCount réduits, shadowBlur 0, non-interactif).
  // isMobile sert uniquement à sélectionner les params, plus à démonter le canvas.
  const isMobile = useIsMobileViewport();
  // Canvas affiché : desktop toujours, mobile si le kill-switch est actif.
  const showCanvas = !isMobile || MOBILE_CANVAS_ENABLED;

  return (
    <section
      className="relative isolate overflow-hidden pt-28 pb-12 md:pb-16"
      // LOT 41 — le scroll vertical ne doit jamais etre capte par le canvas :
      // le navigateur garde le controle du touch-scroll meme si le canvas rame.
      style={{ touchAction: "pan-y" }}
    >
      {/* Background — LOT 6.4-b V3 : le canvas est affiché sur desktop ET
          mobile (kill-switch `MOBILE_CANVAS_ENABLED`). Le fallback
          `matrix-css-fallback` reste rendu (SSR) mais est masqué (classe
          `hidden`) quand le canvas est actif ; il n'est réaffiché que si le
          kill-switch est désactivé sur mobile (repli LOT 42/44). Mêmes
          dimensions partout (absolute inset-0 -z-10) : CLS = 0. */}
      <div
        data-testid={isMobile ? "hero-fallback" : undefined}
        aria-hidden="true"
        className={showCanvas ? "matrix-css-fallback hidden" : "matrix-css-fallback md:hidden"}
      />
      {showCanvas && theme === "dark" ? (
        <>
          <MatrixRain
            className="absolute inset-0 -z-10 opacity-60"
            characters="01"
            fontSize={isMobile ? 16 : 22}
            fadeOpacity={0.08}
            speed={isMobile ? 0.6 : 0.9}
            frameMs={66}
            mobile={isMobile}
          />
          {/* Readability veil: keeps the centered title legible over the rain */}
          <div className="absolute inset-0 -z-10 bg-background/70 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,black,transparent)]" />
        </>
      ) : showCanvas ? (
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
          <ParticleField
            className="absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]"
            particleCount={isMobile ? 5 : 9}
            interactive={!isMobile}
            frameMs={66}
            shadowBlur={isMobile ? 0 : 4}
            mobile={isMobile}
          />
        </div>
      ) : null}
      <div className="absolute inset-0 -z-10 bg-radial-fade" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full hero-blob hero-blob-brand" />
      {/* LOT 44 P0 : blob statique sur mobile (`md:` uniquement) — même
          élément, mêmes couleur/taille/opacité/gradient, zéro changement desktop. */}
      <div className="pointer-events-none absolute right-0 top-40 -z-10 size-[360px] rounded-full hero-blob hero-blob-accent md:animate-float-slow" />

      {/* LOT 41 — contenu au-dessus du canvas (-z-10) en couche propre :
          les taps atteignent les CTA meme si le canvas sature le main thread. */}
      <Container size="wide" className="relative z-10 px-4 sm:px-6 lg:px-8">
        <motion.div
          // LOT 33 — visible des le SSR (LCP) : le conteneur etait aussi
          // opacity:0 en SSR, corriger le seul h1 n'aurait pas suffi.
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
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
      </Container>
    </section>
  );
}
