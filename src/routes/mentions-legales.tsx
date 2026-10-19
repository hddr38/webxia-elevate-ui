import { createFileRoute } from "@tanstack/react-router";
import { LegalContentRenderer } from "@/components/site/legal-content";
import { mentionsContentEn } from "@/content/legal-en";
import { mentionsContent } from "@/content/legal-fr";
import { useLocale } from "@/lib/locale-context";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/mentions-legales")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.mentionsLegales : seo.fr.mentionsLegales;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/mentions-legales" }],
    };
  },
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  const { locale } = useLocale();
  const page = locale === "en" ? mentionsContentEn : mentionsContent;
  return <LegalContentRenderer page={page} />;
}
