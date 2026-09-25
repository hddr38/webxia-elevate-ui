import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowUpRight, ExternalLink, Star } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { getRealisationBySlug } from "@/server/functions/realisations";
import { realisationToDisplay } from "@/lib/mappers";
import { CTAStrip } from "@/components/site/project-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ params }) => {
    try {
      const realisation = await getRealisationBySlug({ data: { slug: params.slug } });
      return {
        item: realisationToDisplay(realisation),
        descriptionMd: realisation.description_md ?? "",
        technologies: realisation.technologies ?? [],
        categories: realisation.category ?? [],
        projectUrl: realisation.project_url,
        githubUrl: realisation.github_url,
        gallery: realisation.gallery_images ?? [],
      };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    const r = loaderData?.item;
    if (!r) return { meta: [{ title: "Réalisation — WebXIA" }] };
    const description = r.shortDescription || `${r.title} — réalisation WebXIA.`;
    return {
      meta: [
        { title: `${r.title} — WebXIA` },
        { name: "description", content: description },
        { property: "og:title", content: r.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `https://webxia.fr/work/${r.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://webxia.fr/work/${r.slug}` }],
    };
  },
  notFoundComponent: RealisationNotFound,
  component: RealisationPage,
});

function RealisationNotFound() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-28 text-center">
      <h1 className="font-display text-3xl">{t("admin.realisations.notFound")}</h1>
      <p className="text-sm text-muted-foreground">{t("admin.realisations.notFoundDesc")}</p>
      <Link to="/work" className="text-brand underline underline-offset-4">
        {t("admin.common.back")}
      </Link>
    </div>
  );
}

function RealisationPage() {
  const { item, descriptionMd, technologies, categories, projectUrl, githubUrl, gallery } =
    Route.useLoaderData();
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
            to="/work"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> {t("admin.common.back")}
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
              {item.category}
            </span>
            {item.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-brand">
                <Star className="size-3 fill-current" aria-hidden="true" />
                {t("admin.form.featured")}
              </span>
            )}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {item.client ?? t("work.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {item.title}
          </h1>
          {item.shortDescription && (
            <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {item.shortDescription}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {item.client && <span className="font-medium text-foreground">{item.client}</span>}
            {item.client && <span aria-hidden="true">·</span>}
            <span>{dateFmt.format(new Date(item.date))}</span>
          </div>
          {technologies.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {technologies.slice(0, 8).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {(projectUrl || githubUrl) && (
            <div className="mt-7 flex flex-wrap gap-2">
              {projectUrl && (
                <Button variant="brand" asChild>
                  <a href={projectUrl} target="_blank" rel="noreferrer">
                    {t("admin.form.projectUrl")}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              )}
              {githubUrl && (
                <Button variant="outline" asChild>
                  <a href={githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="relative mx-auto mt-12 aspect-[16/9] w-full max-w-5xl overflow-hidden rounded-2xl bg-muted">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0" style={{ backgroundImage: item.cover }} />
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
          <div className="text-lg leading-relaxed text-foreground/90 [&>*:first-child]:mt-0 [&>blockquote]:my-6 [&>blockquote]:border-l-4 [&>blockquote]:border-brand/50 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>h2]:mb-4 [&>h2]:mt-10 [&>h2]:font-display [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:tracking-tight [&>h3]:mb-3 [&>h3]:mt-8 [&>h3]:font-display [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:tracking-tight [&>hr]:my-10 [&>hr]:border-border [&>img]:my-8 [&>img]:w-full [&>img]:rounded-2xl [&>ol]:my-6 [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-6 [&>p]:my-6 [&>pre]:my-6 [&>pre]:overflow-x-auto [&>pre]:rounded-2xl [&>pre]:border [&>pre]:border-border [&>pre]:bg-muted [&>pre]:p-4 [&>pre]:text-sm [&>ul]:my-6 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-4 [&_a]:hover:underline [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_pre_code]:bg-transparent [&_pre_code]:p-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {descriptionMd}
            </ReactMarkdown>
          </div>
        </div>

        {gallery.length > 0 && (
          <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {t("admin.form.gallery")}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {gallery.map((src) => (
                <div key={src} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-[16/10] w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {categories.length > 1 && (
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap gap-1.5 px-4 sm:px-6 lg:px-8">
            {categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
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
