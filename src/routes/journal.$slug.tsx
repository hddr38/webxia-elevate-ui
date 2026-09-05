import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { getArticleBySlug } from "@/server/functions/articles";
import { articleToDisplay, type DisplayArticle } from "@/lib/mappers";
import { CTAStrip } from "@/components/site/project-card";

export const Route = createFileRoute("/journal/$slug")({
  loader: async ({ params }) => {
    try {
      const article = await getArticleBySlug({ data: { slug: params.slug } });
      return { article: articleToDisplay(article) };
    } catch {
      throw notFound();
    }
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
        { property: "og:url", content: `https://your-domain.com/journal/${a.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://your-domain.com/journal/${a.slug}` }],
    };
  },
  notFoundComponent: () => {
    const { t } = useLocale();
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-28 text-center">
        <h1 className="font-display text-3xl">{t("journal.article.notFound")}</h1>
        <Link to="/journal" className="text-brand underline">
          {t("journal.article.backToJournal")}
        </Link>
      </div>
    );
  },
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

  return (
    <>
      <article className="pt-28">
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
            {article.content.map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </article>

      <CTAStrip
        eyebrow={t("contact.eyebrow")}
        title={t("home.cta.title")}
        body={t("home.cta.body")}
        cta={t("home.cta.button")}
      />
    </>
  );
}
