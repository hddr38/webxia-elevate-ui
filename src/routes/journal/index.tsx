import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, FileText } from "lucide-react";
import { Container } from "@/components/ui/container";
import { CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { getPublishedArticles } from "@/server/functions/articles";
import { articleToDisplay, type DisplayArticle } from "@/lib/mappers";
import { seo } from "@/lib/seo";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";

export const Route = createFileRoute("/journal/")({
  loader: async () => {
    try {
      const result = await getPublishedArticles({ data: { limit: 100 } });
      return { articles: result.data.map(articleToDisplay) };
    } catch (error) {
      console.error("[journal] Failed to load articles:", error);
      return { articles: [] as DisplayArticle[] };
    }
  },
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.journal : seo.fr.journal;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
        { property: "og:url", content: "https://webxia.fr/journal" },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/journal" }],
    };
  },
  component: JournalPage,
});

function JournalPage() {
  const { articles } = Route.useLoaderData();
  const { t, tDynamic, locale } = useLocale();
  const [filter, setFilter] = useState<string>("all");
  // LOT 5.2 — pattern LOT 43 : aucune animation d'entree JS sur mobile.
  const isMobile = useIsMobileViewport();
  // LOT 5.3 — filtres derives depuis les categories reelles en base (pattern work).
  const categories = [...new Set(articles.map((a) => a.category))].sort();
  const filters = ["all", ...categories];
  const list = filter === "all" ? articles : articles.filter((a) => a.category === filter);

  const dateFmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <section className="relative pt-28 pb-7 md:pb-9">
        <div className="absolute inset-0 -z-10 bg-radial-fade opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <Container size="wide" className="px-4 sm:px-6 lg:px-8">
          <motion.div
            // LOT 5.2 — h1 LCP visible des le SSR (pattern hero LOT 33/34).
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
              {t("journal.eyebrow")}
            </span>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-7xl">
              <span className="text-gradient-brand">{t("journal.title")}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {t("journal.subtitle")}
            </p>
          </motion.div>
        </Container>
      </section>

      <section className="pt-14 pb-20 md:pt-20 md:pb-28">
        <Container size="wide" className="px-4 sm:px-6 lg:px-8">
          {filters.length > 1 && (
            <div className="inline-flex flex-wrap gap-1.5 rounded-full border border-border bg-background/40 p-1 backdrop-blur-md">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`min-h-[44px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 ${
                    filter === f
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tDynamic("journal.filter", f)}
                </button>
              ))}
            </div>
          )}

          {list.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center gap-2 rounded-card border border-border bg-card px-6 py-16 text-center">
              <span
                className="mb-1 inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"
                aria-hidden="true"
              >
                <FileText className="size-6" />
              </span>
              <p className="font-display text-xl font-semibold tracking-tight">
                {filter !== "all" && articles.length > 0
                  ? t("journal.empty.filtered")
                  : t("journal.empty.all")}
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a, i) => {
                // Garde anti-lien-mort : un slug vide pointerait vers /journal lui-même
                // (clic silencieux + remontée en haut). La carte reste visible mais non cliquable.
                const hasSlug = a.slug.trim().length > 0;
                if (!hasSlug) {
                  console.warn(`[journal] Article sans slug ignoré du lien détail : "${a.title}"`);
                }
                const body = (
                  <>
                    <div
                      className="relative aspect-[16/10] overflow-hidden"
                      style={{
                        backgroundImage: a.cover,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
                      <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" />
                      <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
                        {tDynamic("journal.filter", a.category)}
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{dateFmt.format(new Date(a.date))}</span>
                        <span>·</span>
                        <span>
                          {a.readingMinutes} {t("journal.minutes")}
                        </span>
                      </div>
                      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight transition-colors group-hover:text-brand">
                        {a.title}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {a.excerpt}
                      </p>
                      <div className="mt-5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{a.author}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors group-hover:text-brand">
                          {t("journal.readMore")} <ArrowUpRight className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </>
                );
                return (
                  <motion.article
                    key={a.slug || `${a.title}-${i}`}
                    initial={false}
                    whileInView={isMobile ? undefined : { opacity: 1, y: 0 }}
                    viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
                    transition={isMobile ? undefined : { duration: 0.6, delay: i * 0.06 }}
                    className="group overflow-hidden rounded-card border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[var(--shadow-card-hover)]"
                  >
                    {hasSlug ? (
                      <Link to="/journal/$slug" params={{ slug: a.slug }} className="block">
                        {body}
                      </Link>
                    ) : (
                      <div className="block">{body}</div>
                    )}
                  </motion.article>
                );
              })}
            </div>
          )}
        </Container>
      </section>

      <CTAStrip
        eyebrow={t("contact.eyebrow")}
        title={t("home.cta.title")}
        body={t("home.cta.body")}
        cta={t("home.cta.button")}
      />
    </>
  );
}
