import { createFileRoute } from "@tanstack/react-router";
import { Services } from "@/components/site/services";
import { WhyChooseUs } from "@/components/site/why-choose-us";
import { CTAStrip } from "@/components/site/project-card";
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
        { property: "og:url", content: "https://your-domain.com/services" },
      ],
      links: [{ rel: "canonical", href: "https://your-domain.com/services" }],
    };
  },
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useLocale();
  return (
    <div>
      <Services />
      <WhyChooseUs className="py-16 md:py-[5.5rem]" />
      <CTAStrip
        eyebrow={t("contact.eyebrow")}
        title={t("home.cta.title")}
        body={t("home.cta.body")}
        cta={t("home.cta.button")}
        className="py-16 md:py-[5.5rem]"
      />
    </div>
  );
}
