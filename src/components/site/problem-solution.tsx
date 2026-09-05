import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";

export function ProblemSolution() {
  const { t } = useLocale();

  const challenges = [
    t("home.problemSolution.challenges.1"),
    t("home.problemSolution.challenges.2"),
    t("home.problemSolution.challenges.3"),
    t("home.problemSolution.challenges.4"),
  ];

  const solutions = [
    t("home.problemSolution.solutions.1"),
    t("home.problemSolution.solutions.2"),
    t("home.problemSolution.solutions.3"),
    t("home.problemSolution.solutions.4"),
  ];

  return (
    <section className="pt-14 pb-20 md:pt-20 md:pb-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl mb-16 md:mb-20"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("home.problemSolution.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl whitespace-pre-line">
            {t("home.problemSolution.title")}
          </h2>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("home.problemSolution.subtitle")}
          </p>
        </motion.div>

        {/* Two columns with arrow */}
        <div className="relative grid gap-6 sm:gap-8 md:grid-cols-[1fr_auto_1fr] items-stretch">
          {/* Challenges column */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl border border-border bg-card p-6 md:p-8 flex flex-col"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-3">
                <XCircle className="size-5" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {t("home.problemSolution.challenges.title")}
              </h3>
            </div>
            <ul className="space-y-4 flex-1" role="list">
              {challenges.map((challenge, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                >
                  <XCircle
                    className="flex-shrink-0 size-5 text-destructive mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{challenge}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <Button variant="outline" size="lg" asChild>
                <a href="#services">
                  {t("home.problemSolution.ctaLeft")} <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </motion.article>

          {/* Center arrow — desktop only */}
          <div className="hidden md:flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              animate={{ x: [0, -8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-brand/30"
            >
              <ArrowRight className="size-12" />
            </motion.div>
          </div>

          {/* Arrow mobile */}
          <div className="flex md:hidden items-center justify-center py-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              animate={{ x: [0, -6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-brand/30 rotate-90"
            >
              <ArrowRight className="size-10" />
            </motion.div>
          </div>

          {/* Solutions column */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl border border-border bg-card p-6 md:p-8 flex flex-col"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand mb-3">
                <CheckCircle2 className="size-5" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight whitespace-pre-line">
                {t("home.problemSolution.solutions.title")}
              </h3>
            </div>
            <ul className="space-y-4 flex-1" role="list">
              {solutions.map((solution, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                >
                  <CheckCircle2
                    className="flex-shrink-0 size-5 text-brand mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{solution}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <Button variant="brand" size="lg" asChild>
                <a href="#services">
                  {t("home.problemSolution.cta")} <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
