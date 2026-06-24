import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ProjectCard, CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { projects, type ProjectCategory } from "@/data/projects";

export const Route = createFileRoute("/work")({
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
      { property: "og:url", content: "https://webxia-elevate-ui.lovable.app/work" },
    ],
    links: [{ rel: "canonical", href: "https://webxia-elevate-ui.lovable.app/work" }],
  }),
  component: WorkPage,
});

type Filter = "all" | ProjectCategory;
const filters: Filter[] = ["all", "web", "app", "ai", "brand"];

function WorkPage() {
  const { t } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const list = filter === "all" ? projects : projects.filter((p) => p.category === filter);

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

          <div className="mt-12 inline-flex flex-wrap gap-1.5 rounded-full border border-border bg-background/40 p-1 backdrop-blur-md">
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
                {t(`work.filter.${f}` as "work.filter.all")}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p, i) => (
              <ProjectCard key={p.slug} project={p} index={i} />
            ))}
          </div>
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
