import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/locale-context";

// LOT 34 — entrees en vue assagies : 0,35 s (au lieu de 0,6 s) et decalage
// indexe PAR POSITION du bloc (0,08 s/bloc), jamais le meme delai fixe
// copie-colle sur chaque element.
const reveal = (position: number) => ({
  duration: 0.35,
  delay: position * 0.08,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
});

// LOT 39 P2 (QW-3) — l'oscillation decorative infinie (x, repeat: Infinity)
// etait pilotee par `animate` en permanence, meme hors champ et meme en
// display:none sur mobile (cout main thread continu). Elle est desormais
// gatee par l'IntersectionObserver de framer-motion (useInView, once:false)
// : hors champ → x statique, aucune frame JS ; en champ → boucle relancee.
// Un element en display:none est rapporte non-intersecting par l'IO, donc
// la fleche masquee (desktop sur mobile et inversement) ne coute rien.
// Option A du lot (animation-play-state CSS) exigerait des @keyframes dans
// styles.css, hors perimetre : meme objectif, zero changement visuel.
function OscillatingArrow({
  xKeyframes,
  viewportMargin,
  wrapperClassName,
  motionClassName,
  iconClassName,
}: {
  xKeyframes: [number, number, number];
  viewportMargin: "-100px" | "-50px";
  wrapperClassName: string;
  motionClassName: string;
  iconClassName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: viewportMargin });
  return (
    <div className={wrapperClassName}>
      <motion.div
        ref={ref}
        // LOT 39 P2 (QW-2) — visible des le SSR comme le hero (LOT 33).
        initial={false}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: viewportMargin }}
        animate={inView ? { x: xKeyframes } : { x: 0 }}
        transition={
          inView
            ? {
                // LOT 34 — entree assagie (0,35 s, position 2) ; l'oscillation
                // decorative garde sa propre transition (x, infinie).
                ...reveal(2),
                x: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
              }
            : // Subtilite framer-motion : garder repeat:Infinity dans la
              // transition maintient la boucle en vie meme quand la cible
              // devient statique. Hors champ : transition finie courte vers
              // le repos (x:0), puis aucune frame.
              { duration: 0.3 }
        }
        className={motionClassName}
      >
        <ArrowRight className={iconClassName} />
      </motion.div>
    </div>
  );
}

export function ProblemSolution() {
  const { t } = useLocale();

  const challenges = [
    t("home.problemSolution.challenges.1"),
    t("home.problemSolution.challenges.2"),
    t("home.problemSolution.challenges.3"),
    t("home.problemSolution.challenges.4"),
  ];

  const solutions = [
    t("home.problemSolution.solutions.1"),
    t("home.problemSolution.solutions.2"),
    t("home.problemSolution.solutions.3"),
    t("home.problemSolution.solutions.4"),
  ];

  return (
    <section className="pt-14 pb-20 md:pt-20 md:pb-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={reveal(0)}
          className="mx-auto max-w-3xl mb-16 md:mb-20"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("home.problemSolution.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl whitespace-pre-line">
            {t("home.problemSolution.title")}
          </h2>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("home.problemSolution.subtitle")}
          </p>
        </motion.div>

        {/* Two columns with arrow */}
        <div className="relative grid gap-6 sm:gap-8 md:grid-cols-[1fr_auto_1fr] items-stretch">
          {/* Challenges column */}
          <motion.article
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={reveal(1)}
            className="rounded-3xl border border-border bg-card p-6 md:p-8 flex flex-col"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-3">
                <XCircle className="size-5" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {t("home.problemSolution.challenges.title")}
              </h3>
            </div>
            <ul className="space-y-4 flex-1" role="list">
              {challenges.map((challenge, i) => (
                <motion.li
                  key={i}
                  initial={false}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                >
                  <XCircle
                    className="flex-shrink-0 size-5 text-destructive mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{challenge}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <Button variant="outline" size="lg" asChild>
                <Link to="/journal">
                  {t("home.problemSolution.ctaLeft")} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </motion.article>

          {/* Center arrow — desktop only */}
          <OscillatingArrow
            xKeyframes={[0, 10, 5]}
            viewportMargin="-100px"
            wrapperClassName="hidden md:flex items-center justify-center"
            motionClassName="text-brand/30"
            iconClassName="size-12"
          />

          {/* Arrow mobile */}
          <OscillatingArrow
            xKeyframes={[0, -6, 0]}
            viewportMargin="-50px"
            wrapperClassName="flex md:hidden items-center justify-center py-2"
            motionClassName="text-brand/30 rotate-90"
            iconClassName="size-10"
          />

          {/* Solutions column */}
          <motion.article
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={reveal(3)}
            className="rounded-3xl border border-border bg-card p-6 md:p-8 flex flex-col"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand mb-3">
                <CheckCircle2 className="size-5" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight whitespace-pre-line">
                {t("home.problemSolution.solutions.title")}
              </h3>
            </div>
            <ul className="space-y-4 flex-1" role="list">
              {solutions.map((solution, i) => (
                <motion.li
                  key={i}
                  initial={false}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.35, delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                >
                  <CheckCircle2
                    className="flex-shrink-0 size-5 text-brand mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{solution}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <Button variant="brand" size="lg" asChild>
                <Link to="/services">
                  {t("home.problemSolution.cta")} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
