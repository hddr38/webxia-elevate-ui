import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin, Code, Palette, Bot, TrendingUp } from "lucide-react";
import { CTAStrip, ProjectCard } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { founder, expertisePoles } from "@/data/team";
import { projects, type ProjectCategory } from "@/data/projects";
import { useState } from "react";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.about : seo.fr.about;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
        { property: "og:url", content: "https://your-domain.com/about" },
      ],
      links: [{ rel: "canonical", href: "https://your-domain.com/about" }],
    };
  },
  component: AboutPage,
});

const values = [
  { titleKey: "about.values.1.title", descKey: "about.values.1.desc" },
  { titleKey: "about.values.2.title", descKey: "about.values.2.desc" },
  { titleKey: "about.values.3.title", descKey: "about.values.3.desc" },
  { titleKey: "about.values.4.title", descKey: "about.values.4.desc" },
] as const;

const process = [
  { titleKey: "about.process.1.title", descKey: "about.process.1.desc" },
  { titleKey: "about.process.2.title", descKey: "about.process.2.desc" },
  { titleKey: "about.process.3.title", descKey: "about.process.3.desc" },
  { titleKey: "about.process.4.title", descKey: "about.process.4.desc" },
] as const;

const stack = [
  "React 19",
  "TanStack Start",
  "TypeScript",
  "Tailwind v4",
  "Supabase",
  "OpenAI / Anthropic",
  "Figma",
  "Framer Motion",
];

type Filter = "all" | ProjectCategory;
const filters: Filter[] = ["all", "web", "app", "ai", "brand"];

function AboutPage() {
  const { t } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const list = filter === "all" ? projects : projects.filter((p) => p.category === filter);

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-14 md:pb-[4.5rem]">
        <div className="absolute inset-0 -z-10 bg-radial-fade opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
              {t("about.eyebrow")}
            </span>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-7xl">
              <span className="text-gradient-brand">{t("about.title")}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {t("about.subtitle")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur-md">
              <MapPin className="size-3.5 text-brand" />
              {t("about.location")}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("about.manifesto.title")}
          </span>
          <p className="mt-6 font-display text-2xl font-medium leading-snug tracking-[-0.02em] text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("about.manifesto.body")}
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("about.values.title")}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {values.map((v, i) => (
              <motion.div
                key={v.titleKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="font-mono text-xs text-muted-foreground">— 0{i + 1}</div>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
                  {t(v.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(v.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("about.team.title")}
          </h2>
          <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            {t("about.team.body")}
          </p>

          {/* Founder block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mt-12 overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex flex-col md:flex-row">
              {/* Photo placeholder */}
              <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-brand/20 to-accent/10 md:w-72 lg:w-80">
                <div className="text-center">
                  <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-foreground text-background">
                    <span className="font-display text-3xl font-bold">{founder.initials}</span>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{t("about.team.photoAlt")}</p>
                </div>
              </div>
              {/* Info */}
              <div className="flex flex-1 flex-col justify-center p-8 md:p-10">
                <h3 className="font-display text-2xl font-semibold tracking-tight">
                  {founder.name}
                </h3>
                <div className="mt-1 text-sm font-medium uppercase tracking-wider text-brand">
                  {t(founder.roleKey)}
                </div>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                  {t(founder.bioKey)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Expertise poles */}
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {expertisePoles.map((pole, i) => {
              const icons = { code: Code, palette: Palette, bot: Bot, "trending-up": TrendingUp };
              const Icon = icons[pole.icon as keyof typeof icons] || Code;
              return (
                <motion.article
                  key={pole.titleKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background/50 text-brand">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
                    {t(pole.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(pole.descKey)}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("about.process.title")}
          </h2>
          <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            {t("about.process.subtitle")}
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((p, i) => (
              <div key={p.titleKey} className="bg-card p-6">
                <div className="font-mono text-xs text-brand">— 0{i + 1}</div>
                <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                  {t(p.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(p.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Réalisations */}
      <section id="realisations" className="py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("work.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("work.title")}
          </h2>
          <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            {t("work.subtitle")}
          </p>

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

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        className="py-11 md:py-16"
      />
    </>
  );
}
