import { createFileRoute } from "@tanstack/react-router";
import { LegalContentRenderer } from "@/components/site/legal-content";
import { confidentialiteContentEn } from "@/content/legal-en";
import { confidentialiteContent } from "@/content/legal-fr";
import { useLocale } from "@/lib/locale-context";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/politique-confidentialite")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.politiqueConfidentialite : seo.fr.politiqueConfidentialite;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/politique-confidentialite" }],
    };
  },
  component: PolitiqueConfidentialitePage,
});

function PolitiqueConfidentialitePage() {
  const { locale } = useLocale();
  const page = locale === "en" ? confidentialiteContentEn : confidentialiteContent;
  return <LegalContentRenderer page={page} />;
}
