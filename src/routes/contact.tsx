import { createFileRoute } from "@tanstack/react-router";
import { Contact } from "@/components/site/contact";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.contact : seo.fr.contact;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
        { property: "og:url", content: "https://your-domain.com/contact" },
      ],
      links: [{ rel: "canonical", href: "https://your-domain.com/contact" }],
    };
  },
  component: ContactPage,
});

function ContactPage() {
  return (
    <div>
      <Contact />
    </div>
  );
}
