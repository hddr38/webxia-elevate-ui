import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/locale-context";

const expertises = [
  {
    icon: "🌐",
    titleKey: "home.expertises.1.title" as const,
    hookKey: "home.expertises.1.hook" as const,
    descKey: "home.expertises.1.desc" as const,
    sectionId: "services",
  },
  {
    icon: "🎨",
    titleKey: "home.expertises.2.title" as const,
    hookKey: "home.expertises.2.hook" as const,
    descKey: "home.expertises.2.desc" as const,
    sectionId: "section-2",
  },
  {
    icon: "📈",
    titleKey: "home.expertises.3.title" as const,
    hookKey: "home.expertises.3.hook" as const,
    descKey: "home.expertises.3.desc" as const,
    sectionId: "section-3",
  },
  {
    icon: "🤖",
    titleKey: "home.expertises.4.title" as const,
    hookKey: "home.expertises.4.hook" as const,
    descKey: "home.expertises.4.desc" as const,
    sectionId: "section-4",
  },
  {
    icon: "💻",
    titleKey: "home.expertises.5.title" as const,
    hookKey: "home.expertises.5.hook" as const,
    descKey: "home.expertises.5.desc" as const,
    sectionId: "section-1",
  },
  {
    icon: "📊",
    titleKey: "home.expertises.6.title" as const,
    hookKey: "home.expertises.6.hook" as const,
    descKey: "home.expertises.6.desc" as const,
    sectionId: "section-5",
  },
  {
    icon: "🛡️",
    titleKey: "home.expertises.7.title" as const,
    hookKey: "home.expertises.7.hook" as const,
    descKey: "home.expertises.7.desc" as const,
    sectionId: "section-6",
  },
];

export function Expertises() {
  const { t } = useLocale();

  return (
    <section className="pt-14 pb-20 md:pt-20 md:pb-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl mb-16 md:mb-20"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("home.expertises.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {t("home.expertises.title")}
          </h2>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("home.expertises.subtitle")}
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {expertises.map((exp, i) => (
            <motion.article
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
            >
              <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-brand/0 via-transparent to-brand/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:from-brand/10 group-hover:to-accent/5" />

              <span className="text-3xl">{exp.icon}</span>

              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
                {t(exp.titleKey)}
              </h3>
              <p className="mt-2 text-sm font-medium text-foreground/80">{t(exp.hookKey)}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                {t(exp.descKey)}
              </p>

              <Link
                to="/services"
                hash={exp.sectionId}
                className="mt-6 flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors group-hover:text-brand"
              >
                <span>{t("services.learnMore")}</span>
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </motion.article>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-14 flex justify-center"
        >
          <Button variant="brand" size="lg" asChild>
            <Link to="/services">
              {t("home.expertises.cta")} <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
