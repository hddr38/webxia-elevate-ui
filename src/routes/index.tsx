import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { ProblemSolution } from "@/components/site/problem-solution";
import { Expertises } from "@/components/site/expertises";
import { WhyChooseUs } from "@/components/site/why-choose-us";
import { DbRealisationCard, CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { getPublishedRealisations } from "@/server/functions/realisations";
import { realisationToDisplay, type DisplayRealisation } from "@/lib/mappers";
import { seo } from "@/lib/seo";

interface HomeWorkItem {
  item: DisplayRealisation;
  technologies: string[];
}

export const Route = createFileRoute("/")({
  loader: async (): Promise<{ work: HomeWorkItem[] }> => {
    try {
      const result = await getPublishedRealisations({ data: { limit: 10 } });
      return {
        work: result.data.map((r) => ({
          item: realisationToDisplay(r),
          technologies: r.technologies ?? [],
        })),
      };
    } catch (error) {
      console.error("[home] Failed to load realisations:", error);
      return { work: [] };
    }
  },
  head: (ctx) => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.home : seo.fr.home;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
        { property: "og:url", content: "https://webxia.fr/" },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/" }],
    };
  },
  component: Index,
});

function Index() {
  const { t } = useLocale();
  const { work } = Route.useLoaderData();
  // Réalisations publiées réelles, à la une d'abord, 3 maximum.
  const featured = [...work]
    .sort((a, b) => Number(b.item.featured) - Number(a.item.featured))
    .slice(0, 3);
  return (
    <>
      <Hero />
      <ProblemSolution />
      <Expertises />
      <WhyChooseUs />

      {featured.length > 0 && (
        <section className="pt-20 pb-24 md:pt-24 md:pb-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
                  {t("home.work.eyebrow")}
                </span>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                  {t("home.work.title")}
                </h2>
              </div>
              <Link
                to="/work"
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-brand focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
              >
                {t("home.work.cta")} <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((r, i) => (
                <DbRealisationCard
                  key={r.item.slug || `${r.item.title}-${i}`}
                  item={r.item}
                  technologies={r.technologies}
                  index={i}
                />
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
        className="pt-20 pb-24 md:pt-24 md:pb-32"
      />
    </>
  );
}
