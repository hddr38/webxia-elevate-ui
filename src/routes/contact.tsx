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
        { property: "og:url", content: "https://webxia.fr/contact" },
      ],
      links: [
        { rel: "canonical", href: "https://webxia.fr/contact" },
        // FR/EN partagent la même URL (locale en localStorage) : hreflang
        // symétrique + x-default vers la version FR (locale par défaut).
        { rel: "alternate", href: "https://webxia.fr/contact", hrefLang: "fr" },
        { rel: "alternate", href: "https://webxia.fr/contact", hrefLang: "en" },
        { rel: "alternate", href: "https://webxia.fr/contact", hrefLang: "x-default" },
        // Click-to-load : aucun appel Cal.com avant le clic, mais la
        // connexion est pré-établie pour un affichage instantané ensuite.
        { rel: "preconnect", href: "https://app.cal.com" },
        { rel: "dns-prefetch", href: "https://app.cal.com" },
        { rel: "preconnect", href: "https://cal.com" },
        { rel: "dns-prefetch", href: "https://cal.com" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: "WebXIA",
            url: "https://webxia.fr/contact",
            email: "webxia@protonmail.com",
            telephone: "+33650673025",
            address: {
              "@type": "PostalAddress",
              streetAddress: "101 cours de la Marne",
              postalCode: "33800",
              addressLocality: "Bordeaux",
              addressCountry: "FR",
            },
          }),
        },
      ],
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
