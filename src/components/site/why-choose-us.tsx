import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

export function WhyChooseUs({ className }: { className?: string }) {
  const { t } = useLocale();

  const engagements = [
    t("home.whyChooseUs.1"),
    t("home.whyChooseUs.2"),
    t("home.whyChooseUs.3"),
    t("home.whyChooseUs.4"),
    t("home.whyChooseUs.5"),
    t("home.whyChooseUs.6"),
    t("home.whyChooseUs.7"),
    t("home.whyChooseUs.8"),
  ];

  return (
    <section className={cn("pt-14 pb-20 md:pt-20 md:pb-28", className)}>
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
            {t("home.whyChooseUs.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {t("home.whyChooseUs.title")}
          </h2>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("home.whyChooseUs.subtitle")}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 md:p-12"
        >
          <p className="text-base text-muted-foreground sm:text-lg">{t("home.whyChooseUs.body")}</p>
          <h3 className="mt-8 font-display text-xl font-semibold tracking-tight">
            {t("home.whyChooseUs.engagementsTitle")}
          </h3>
          <ul className="mt-6 space-y-4" role="list">
            {engagements.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex items-start gap-3 text-sm text-muted-foreground"
              >
                <Check className="size-5 mt-0.5 shrink-0 text-brand" />
                <span className="text-foreground">{item}</span>
              </motion.li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center">
            <Button variant="brand" size="lg" asChild>
              <Link to="/contact">
                {t("home.whyChooseUs.cta")} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
