import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";
import { team } from "@/data/team";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — WebXIA studio" },
      {
        name: "description",
        content:
          "A small, senior team obsessed with craft and outcomes. Strategy, design, engineering and AI under one roof.",
      },
      { property: "og:title", content: "About — WebXIA studio" },
      { property: "og:description", content: "Meet the team behind WebXIA." },
      { property: "og:url", content: "https://webxia-elevate-ui.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://webxia-elevate-ui.lovable.app/about" }],
  }),
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
  "Edge runtimes",
  "Supabase",
  "OpenAI / Anthropic",
  "Figma",
  "Framer Motion",
];

function AboutPage() {
  const { t } = useLocale();

  return (
    <>
      {/* Hero */}
      <section className="relative pt-40 pb-20">
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
      <section className="py-20">
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
      <section className="py-20">
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
                <div className="font-mono text-xs text-muted-foreground">
                  — 0{i + 1}
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
                  {t(v.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(v.descKey)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("about.team.title")}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m, i) => (
              <motion.article
                key={m.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div
                  className="relative flex aspect-square items-center justify-center"
                  style={{ backgroundImage: m.accent }}
                >
                  <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" />
                  <span className="font-display text-5xl font-bold text-white/90 drop-shadow">
                    {m.initials}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {m.name}
                  </h3>
                  <div className="text-xs uppercase tracking-wider text-brand">
                    {m.role}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {m.bio}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("about.process.title")}
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((p, i) => (
              <div key={p.titleKey} className="bg-card p-6">
                <div className="font-mono text-xs text-brand">— 0{i + 1}</div>
                <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                  {t(p.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(p.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("about.stack.title")}
          </h2>
          <div className="mt-8 flex flex-wrap gap-2">
            {stack.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80"
              >
                {tech}
              </span>
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
