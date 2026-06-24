import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { Services } from "@/components/site/services";
import { ProjectCard, CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { projects } from "@/data/projects";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WebXIA — Premium web & AI studio" },
      {
        name: "description",
        content:
          "WebXIA is a senior product team designing and shipping high-performance websites, applications and AI tooling for ambitious brands.",
      },
      { property: "og:title", content: "WebXIA — Premium web & AI studio" },
      { property: "og:description", content: "Engineered web experiences for ambitious brands." },
      { property: "og:url", content: "https://webxia-elevate-ui.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://webxia-elevate-ui.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { t } = useLocale();
  const featured = projects.slice(0, 3);
  return (
    <>
      <Hero />
      <Services />

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
                {t("home.work.eyebrow")}
              </span>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
                {t("home.work.title")}
              </h2>
            </div>
            <Link
              to="/work"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-brand"
            >
              {t("home.work.cta")} <ArrowUpRight className="size-4" />
            </Link>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
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
