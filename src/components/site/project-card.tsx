import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Star } from "lucide-react";
import { motion } from "framer-motion";
import type { DisplayRealisation } from "@/lib/mappers";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";

/**
 * Carte réalisation alimentée par la DB (page /work) : lien vers /work/$slug.
 * Sans slug, carte non cliquable (garde anti-lien-mort : un slug vide
 * pointerait vers /work lui-même).
 */
export function DbRealisationCard({
  item,
  technologies,
  index = 0,
}: {
  item: DisplayRealisation;
  technologies: string[];
  index?: number;
}) {
  const { t } = useLocale();
  // LOT 43 Phase 2 — mobile : aucune animation d'entree JS.
  const isMobile = useIsMobileViewport();
  const hasSlug = item.slug.trim().length > 0;
  if (!hasSlug) {
    console.warn(`[work] Réalisation sans slug ignorée du lien détail : "${item.title}"`);
  }

  const body = (
    <>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: item.cover }} />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white">
          {item.category}
        </div>
        {item.featured && (
          <div className="absolute left-4 top-11 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/90">
            <Star className="size-3 fill-current" aria-hidden="true" />
            {t("admin.form.featured")}
          </div>
        )}
        <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 font-mono text-[10px] font-medium text-white">
          {item.year}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
          <div className="text-white">
            {item.client && (
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
                {item.client}
              </div>
            )}
            <div className="mt-1 font-display text-lg font-semibold leading-tight">
              {item.title}
            </div>
          </div>
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/30 text-white transition-transform group-hover:rotate-45">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>
      {technologies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-4">
          {technologies.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );

  return (
    <motion.article
      initial={false}
      whileInView={isMobile ? undefined : { opacity: 1, y: 0 }}
      viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
      transition={
        isMobile ? undefined : { duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }
      }
      className="group relative overflow-hidden rounded-card border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[var(--shadow-card-hover)]"
    >
      {hasSlug ? (
        <Link to="/work/$slug" params={{ slug: item.slug }} className="block">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
    </motion.article>
  );
}

export function CTAStrip({
  eyebrow,
  title,
  body,
  cta,
  className,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  cta: string;
  className?: string;
}) {
  // ANIM-1 — reveal au scroll aligne sur le motif des sections voisines
  // (DbRealisationCard l.93-98 / services / footer) : `initial={false}`
  // (visible dès le SSR, convention LOT 43 — verrouillé par
  // sections-mobile.test.tsx) + `whileInView` gate mobile. Pas de stagger,
  // pas d'exit, transform/opacity seuls.
  const isMobile = useIsMobileViewport();
  return (
    <motion.section
      initial={false}
      whileInView={isMobile ? undefined : { opacity: 1, y: 0 }}
      viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
      transition={isMobile ? undefined : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn("py-24 md:py-32", className)}
    >
      <Container size="wide" className="px-4 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card p-10 text-center sm:p-16">
          <div className="absolute inset-0 bg-radial-fade opacity-70" aria-hidden="true" />
          {eyebrow && (
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand-text">
              {eyebrow}
            </span>
          )}
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground">
            {body}
          </p>
          <Button variant="hero" size="lg" asChild className="mt-8">
            <Link to="/contact">
              {cta} <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </motion.section>
  );
}
