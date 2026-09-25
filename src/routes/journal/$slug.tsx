import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { getArticleBySlug } from "@/server/functions/articles";
import { articleToDisplay, type DisplayArticle } from "@/lib/mappers";
import { CTAStrip } from "@/components/site/project-card";

export const Route = createFileRoute("/journal/$slug")({
  loader: async ({ params }) => {
    try {
      const article = await getArticleBySlug({ data: { slug: params.slug } });
      return {
        article: articleToDisplay(article),
        rawContent: article.content_md ?? "",
        coverUrl: article.cover_image_url,
        tags: article.tags ?? [],
        categories: article.category ?? [],
      };
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
        { property: "og:url", content: `https://webxia.fr/journal/${a.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://webxia.fr/journal/${a.slug}` }],
    };
  },
  notFoundComponent: ArticleNotFound,
  component: ArticlePage,
});

function ArticleNotFound() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-28 text-center">
      <h1 className="font-display text-3xl">{t("journal.article.notFound")}</h1>
      <Link to="/journal" className="text-brand underline">
        {t("journal.article.backToJournal")}
      </Link>
    </div>
  );
}

function ArticlePage() {
  const { article, rawContent, coverUrl, tags, categories } = Route.useLoaderData();
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
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> {t("journal.back")}
          </Link>

          <div className="mt-8 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
            {t(`journal.filter.${article.category}` as "journal.filter.article")}
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {article.excerpt}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{article.author}</span>
            <span aria-hidden="true">·</span>
            <span>{dateFmt.format(new Date(article.date))}</span>
            <span aria-hidden="true">·</span>
            <span>
              {article.readingMinutes} {t("journal.minutes")}
            </span>
          </div>
          {(categories.length > 0 || tags.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {[...categories, ...tags].slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative mx-auto mt-12 aspect-[16/9] w-full max-w-5xl overflow-hidden rounded-2xl bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0" style={{ backgroundImage: article.cover }} />
          )}
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay"
            aria-hidden="true"
          />
        </div>

        <div className="mx-auto mt-12 max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-lg leading-relaxed text-foreground/90 [&>*:first-child]:mt-0 [&>blockquote]:my-6 [&>blockquote]:border-l-4 [&>blockquote]:border-brand/50 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>h2]:mb-4 [&>h2]:mt-10 [&>h2]:font-display [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:tracking-tight [&>h3]:mb-3 [&>h3]:mt-8 [&>h3]:font-display [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:tracking-tight [&>hr]:my-10 [&>hr]:border-border [&>img]:my-8 [&>img]:w-full [&>img]:rounded-2xl [&>ol]:my-6 [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-6 [&>p]:my-6 [&>pre]:my-6 [&>pre]:overflow-x-auto [&>pre]:rounded-2xl [&>pre]:border [&>pre]:border-border [&>pre]:bg-muted [&>pre]:p-4 [&>pre]:text-sm [&>table]:my-6 [&>table]:w-full [&>table]:overflow-hidden [&>table]:rounded-2xl [&>table]:border [&>table]:border-border [&>table]:text-base [&>td]:border-t [&>td]:border-border [&>td]:px-4 [&>td]:py-2.5 [&>th]:bg-muted [&>th]:px-4 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-sm [&>ul]:my-6 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-4 [&_a]:hover:underline [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_pre_code]:bg-transparent [&_pre_code]:p-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {rawContent}
            </ReactMarkdown>
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
