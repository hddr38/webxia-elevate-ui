import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { FolderKanban } from "lucide-react";
import { DbRealisationCard, CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { getPublishedRealisations } from "@/server/functions/realisations";
import { realisationToDisplay, type DisplayRealisation } from "@/lib/mappers";

interface WorkItem {
  item: DisplayRealisation;
  technologies: string[];
  categories: string[];
}

export const Route = createFileRoute("/work/")({
  loader: async (): Promise<{ realisations: WorkItem[] }> => {
    try {
      const result = await getPublishedRealisations({ data: { limit: 100 } });
      return {
        realisations: result.data.map((r) => ({
          item: realisationToDisplay(r),
          technologies: r.technologies ?? [],
          categories: r.category ?? [],
        })),
      };
    } catch (error) {
      console.error("[work] Failed to load realisations:", error);
      return { realisations: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Work — WebXIA" },
      {
        name: "description",
        content:
          "Selected work across web, app, AI and brand — recent products shipped by the WebXIA studio.",
      },
      { property: "og:title", content: "Work — WebXIA" },
      { property: "og:description", content: "Selected work from the WebXIA studio." },
      { property: "og:url", content: "https://webxia.fr/work" },
    ],
    links: [{ rel: "canonical", href: "https://webxia.fr/work" }],
  }),
  component: WorkPage,
});

const KNOWN_FILTERS = ["web", "app", "ai", "brand"] as const;

function WorkPage() {
  const { t } = useLocale();
  const { realisations } = Route.useLoaderData();
  const [filter, setFilter] = useState<string>("all");

  // Filtres construits depuis les catégories réellement présentes en DB.
  const categories = [...new Set(realisations.flatMap((r) => r.categories))].sort();
  const filters = ["all", ...categories];
  const list =
    filter === "all" ? realisations : realisations.filter((r) => r.categories.includes(filter));

  const filterLabel = (f: string) =>
    f === "all"
      ? t("work.filter.all")
      : (KNOWN_FILTERS as readonly string[]).includes(f)
        ? t(`work.filter.${f}` as "work.filter.all")
        : f;

  return (
    <>
      <section className="relative pt-40 pb-12">
        <div className="absolute inset-0 -z-10 bg-radial-fade opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
              {t("work.eyebrow")}
            </span>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-7xl">
              <span className="text-gradient-brand">{t("work.title")}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {t("work.subtitle")}
            </p>
          </motion.div>

          {filters.length > 1 && (
            <div className="mt-12 inline-flex max-w-full flex-wrap gap-1.5 rounded-full border border-border bg-background/40 p-1 backdrop-blur-md">
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
                  {filterLabel(f)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-center">
              <span
                className="mb-1 inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"
                aria-hidden="true"
              >
                <FolderKanban className="size-6" />
              </span>
              <p className="font-display text-xl font-semibold tracking-tight">
                {t("admin.realisations.empty")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((r, i) => (
                <DbRealisationCard
                  key={r.item.slug || `${r.item.title}-${i}`}
                  item={r.item}
                  technologies={r.technologies}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
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
