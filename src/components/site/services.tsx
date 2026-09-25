import { motion } from "framer-motion";
import {
  Globe,
  CreditCard,
  Palette,
  Zap,
  FileText,
  Smartphone,
  Cloud,
  ArrowUpRight,
  Monitor,
  Sparkles,
  Printer,
  Share2,
  Search,
  Megaphone,
  PenTool,
  Mail,
  BarChart3,
  MessageSquare,
  Bot,
  Users,
  BookOpen,
  Shield,
  Wrench,
  Phone,
  TrendingUp,
  MapPin,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { servicesFr, type ServiceCardData, type ServiceSectionData } from "@/data/services-fr";
import { servicesEn } from "@/data/services-en";

const iconMap: Record<string, LucideIcon> = {
  Globe,
  CreditCard,
  Palette,
  Zap,
  FileText,
  Smartphone,
  Cloud,
  Monitor,
  Sparkles,
  Printer,
  Share2,
  Search,
  Megaphone,
  PenTool,
  Mail,
  BarChart3,
  MessageSquare,
  Bot,
  Users,
  BookOpen,
  Shield,
  Wrench,
  Phone,
  TrendingUp,
  MapPin,
  MessageCircle,
};

const servicesData = { fr: servicesFr, en: servicesEn };

type ServiceCardProps = {
  card: ServiceCardData;
  index: number;
  learnMore: string;
};

function ServiceCard({ card, index, learnMore }: ServiceCardProps) {
  const Icon = iconMap[card.icon] ?? Globe;
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand/0 via-transparent to-brand/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:from-brand/10 group-hover:to-accent/5" />

      <div className="flex items-center justify-between">
        <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background/50 text-foreground transition-colors group-hover:border-brand/40 group-hover:text-brand">
          <Icon className="size-5" />
        </span>
        <span className="font-mono text-xs text-muted-foreground">— {card.tag}</span>
      </div>

      <h3 className="mt-8 font-display text-xl font-semibold tracking-tight">{card.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>

      <ul className="mt-4 space-y-2">
        {card.bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="size-4 mt-0.5 shrink-0 text-brand" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6 flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors group-hover:text-brand">
        <span>{learnMore}</span>
        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </motion.article>
  );
}

export function Services() {
  const { locale, t } = useLocale();
  const sections: ServiceSectionData[] = servicesData[locale] ?? servicesFr;
  const learnMore = t("services.learnMore");

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <section
          key={sectionIndex}
          id={sectionIndex === 0 ? "services" : `section-${sectionIndex}`}
          className="relative py-16 md:py-[5.5rem]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              {section.eyebrow && (
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
                  {section.eyebrow}
                </span>
              )}
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
                {section.title}
              </h2>
              <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
                {section.subtitle}
              </p>
            </div>

            {section.cards && (
              <div
                className={`mt-16 grid gap-5 sm:grid-cols-2 ${section.cards.length === 2 ? "lg:grid-cols-2 max-w-4xl mx-auto" : section.cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
              >
                {section.cards.map((card, cardIndex) => (
                  <ServiceCard key={card.tag} card={card} index={cardIndex} learnMore={learnMore} />
                ))}
              </div>
            )}

            {section.engagements && (
              <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-border bg-card p-8 md:p-12">
                <p className="text-base text-muted-foreground sm:text-lg">
                  {t("home.whyChooseUs.body")}
                </p>
                <h3 className="mt-8 font-display text-xl font-semibold tracking-tight">
                  {t("services.engagements")}
                </h3>
                <ul className="mt-6 space-y-4">
                  {section.engagements.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="size-5 mt-0.5 shrink-0 text-brand" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
