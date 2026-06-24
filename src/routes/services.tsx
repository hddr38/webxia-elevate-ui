import { createFileRoute } from "@tanstack/react-router";
import { Services } from "@/components/site/services";
import { CTAStrip } from "@/components/site/project-card";
import { useLocale } from "@/lib/locale-context";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — WebXIA" },
      {
        name: "description",
        content:
          "Four sharp services: web design & brand, web & app development, AI integration, growth & SEO.",
      },
      { property: "og:title", content: "Services — WebXIA" },
      { property: "og:description", content: "From strategy to launch — design, development, AI, growth." },
      { property: "og:url", content: "https://webxia-elevate-ui.lovable.app/services" },
    ],
    links: [{ rel: "canonical", href: "https://webxia-elevate-ui.lovable.app/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useLocale();
  return (
    <div className="pt-32">
      <Services />
      <CTAStrip
        eyebrow={t("contact.eyebrow")}
        title={t("home.cta.title")}
        body={t("home.cta.body")}
        cta={t("home.cta.button")}
      />
    </div>
  );
}
