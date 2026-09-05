import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { getPublishedArticles } from "@/server/functions/articles";
import { articleToDisplay, type DisplayArticle } from "@/lib/mappers";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/journal")({
  loader: async () => {
    const result = await getPublishedArticles({ data: {} });
    return { articles: result.data.map(articleToDisplay) };
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
        { property: "og:url", content: "https://your-domain.com/journal" },
      ],
      links: [{ rel: "canonical", href: "https://your-domain.com/journal" }],
    };
  },
  component: JournalPage,
});

const filters = ["all", "article", "case-study", "news"] as const;

function JournalPage() {
  const { articles } = Route.useLoaderData();
  const { t, locale } = useLocale();
  const [filter, setFilter] = useState<string>("all");
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
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
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex flex-wrap gap-1.5 rounded-full border border-border bg-background/40 p-1 backdrop-blur-md">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`journal.filter.${f}` as "journal.filter.all")}
              </button>
            ))}
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a, i) => (
              <motion.article
                key={a.slug}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-brand/40"
              >
                <Link to="/journal/$slug" params={{ slug: a.slug }} className="block">
                  <div
                    className="relative aspect-[16/10] overflow-hidden"
                    style={{ backgroundImage: a.cover }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
                    <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" />
                    <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
                      {t(`journal.filter.${a.category}` as "journal.filter.article")}
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
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
