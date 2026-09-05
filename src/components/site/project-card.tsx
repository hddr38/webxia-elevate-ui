import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Project } from "@/data/projects";
import { cn } from "@/lib/utils";

export function ProjectCard({ project, index = 0 }: { project: Project; index?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
    >
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ backgroundImage: project.cover }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
          {project.category}
        </div>
        <div className="absolute right-4 top-4 font-mono text-[10px] text-white/70">
          {project.year}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
          <div className="text-white">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              {project.client}
            </div>
            <div className="mt-1 font-display text-lg font-semibold leading-tight">
              {project.title}
            </div>
          </div>
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform group-hover:rotate-45">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-5 py-4">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.article>
  );
}

export function CTAStrip({
  eyebrow,
  title,
  body,
  cta,
  className,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  cta: string;
  className?: string;
}) {
  return (
    <section className={cn("py-24 md:py-32", className)}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center sm:p-16">
          <div className="absolute inset-0 -z-10 bg-radial-fade opacity-70" />
          {eyebrow && (
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
              {eyebrow}
            </span>
          )}
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground">
            {body}
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:scale-[1.03]"
          >
            {cta} <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
