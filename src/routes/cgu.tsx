import { createFileRoute } from "@tanstack/react-router";
import { LegalContentRenderer } from "@/components/site/legal-content";
import { cguContentEn } from "@/content/legal-en";
import { cguContent } from "@/content/legal-fr";
import { useLocale } from "@/lib/locale-context";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/cgu")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.cgu : seo.fr.cgu;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/cgu" }],
    };
  },
  component: CguPage,
});

function CguPage() {
  const { locale } = useLocale();
  const page = locale === "en" ? cguContentEn : cguContent;
  return <LegalContentRenderer page={page} />;
}
