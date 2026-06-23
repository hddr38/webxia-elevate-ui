import { motion } from "framer-motion";
import { Layers, Code2, Sparkles, LineChart, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

type Service = {
  icon: LucideIcon;
  titleKey: "service.1.title" | "service.2.title" | "service.3.title" | "service.4.title";
  descKey: "service.1.desc" | "service.2.desc" | "service.3.desc" | "service.4.desc";
  tag: string;
};

const services: Service[] = [
  { icon: Layers, titleKey: "service.1.title", descKey: "service.1.desc", tag: "01" },
  { icon: Code2, titleKey: "service.2.title", descKey: "service.2.desc", tag: "02" },
  { icon: Sparkles, titleKey: "service.3.title", descKey: "service.3.desc", tag: "03" },
  { icon: LineChart, titleKey: "service.4.title", descKey: "service.4.desc", tag: "04" },
];

export function Services() {
  const { t } = useLocale();

  return (
    <section id="services" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("services.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {t("services.title")}
          </h2>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("services.subtitle")}
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.article
                key={s.tag}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand/0 via-transparent to-brand/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:from-brand/10 group-hover:to-accent/5" />

                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background/50 text-foreground transition-colors group-hover:border-brand/40 group-hover:text-brand">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">— {s.tag}</span>
                </div>

                <h3 className="mt-8 font-display text-xl font-semibold tracking-tight">
                  {t(s.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(s.descKey)}</p>

                <div className="mt-8 flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors group-hover:text-brand">
                  <span>Learn more</span>
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
