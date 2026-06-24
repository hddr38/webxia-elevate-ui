import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { articles } from "@/data/articles";
import { CTAStrip } from "@/components/site/project-card";

export const Route = createFileRoute("/journal/$slug")({
  loader: ({ params }) => {
    const article = articles.find((a) => a.slug === params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    if (!a) return { meta: [{ title: "Article — WebXIA" }] };
    return {
      meta: [
        { title: `${a.title} — WebXIA Journal` },
        { name: "description", content: a.excerpt },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `https://webxia-elevate-ui.lovable.app/journal/${a.slug}` },
      ],
      links: [
        { rel: "canonical", href: `https://webxia-elevate-ui.lovable.app/journal/${a.slug}` },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-32 text-center">
      <h1 className="font-display text-3xl">Article not found</h1>
      <Link to="/journal" className="text-brand underline">
        Back to journal
      </Link>
    </div>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const { t, locale } = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const related = articles.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <>
      <article className="pt-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/journal"
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-brand"
          >
            <ArrowLeft className="size-3.5" /> {t("journal.back")}
          </Link>

          <div className="mt-8 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
            {t(`journal.filter.${article.category}` as "journal.filter.article")}
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {article.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{article.author}</span>
            <span>·</span>
            <span>{dateFmt.format(new Date(article.date))}</span>
            <span>·</span>
            <span>
              {article.readingMinutes} {t("journal.minutes")}
            </span>
          </div>
        </div>

        <div
          className="relative mx-auto mt-12 aspect-[16/9] w-full max-w-5xl overflow-hidden rounded-2xl"
          style={{ backgroundImage: article.cover }}
        >
          <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" />
        </div>

        <div className="mx-auto mt-12 max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 text-lg leading-relaxed text-foreground/90">
            {article.content.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("journal.related")}
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
                <Link
                  key={a.slug}
                  to="/journal/$slug"
                  params={{ slug: a.slug }}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-brand/40"
                >
                  <div
                    className="aspect-[16/10]"
                    style={{ backgroundImage: a.cover }}
                  />
                  <div className="p-5">
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand">
                      {t(`journal.filter.${a.category}` as "journal.filter.article")}
                    </div>
                    <h3 className="mt-2 font-display text-base font-semibold tracking-tight transition-colors group-hover:text-brand">
                      {a.title}
                    </h3>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground/70">
                      {t("journal.readMore")} <ArrowUpRight className="size-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTAStrip
        eyebrow={t("contact.eyebrow")}
        title={t("home.cta.title")}
        body={t("home.cta.body")}
        cta={t("home.cta.button")}
      />
    </>
  );
}
