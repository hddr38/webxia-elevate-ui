import { createFileRoute } from "@tanstack/react-router";
import { Services } from "@/components/site/services";
import { WhyChooseUs } from "@/components/site/why-choose-us";
import { CTAStrip } from "@/components/site/project-card";
import { Container } from "@/components/ui/container";
import { useLocale } from "@/lib/locale-context";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/services")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.services : seo.fr.services;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
        { property: "og:url", content: "https://webxia.fr/services" },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/services" }],
    };
  },
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useLocale();
  return (
    <div>
      <section className="relative pt-28 pb-7 md:pb-9">
        <div className="absolute inset-0 -z-10 bg-radial-fade opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <Container size="wide" className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
              {t("services.eyebrow")}
            </span>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-7xl">
              <span className="text-gradient-brand">{t("services.title")}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {t("services.subtitle")}
            </p>
          </div>
        </Container>
      </section>

      <Services />
      <WhyChooseUs className="pt-14 pb-20 md:pt-20 md:pb-28" />
      <CTAStrip
        eyebrow={t("contact.eyebrow")}
        title={t("home.cta.title")}
        body={t("home.cta.body")}
        cta={t("home.cta.button")}
        className="pt-14 pb-20 md:pt-20 md:pb-28"
      />
    </div>
  );
}
