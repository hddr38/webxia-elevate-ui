type SeoEntry = {
  title: string;
  description: string;
  ogDescription: string;
};

type SeoPage = {
  home: SeoEntry;
  about: SeoEntry;
  services: SeoEntry;
  contact: SeoEntry;
  journal: SeoEntry;
  cgu: SeoEntry;
  mentionsLegales: SeoEntry;
  politiqueConfidentialite: SeoEntry;
};

export const seo: Record<"fr" | "en", SeoPage> = {
  fr: {
    home: {
      title: "WebXIA — Studio web & IA premium",
      description:
        "WebXIA est une équipe produit senior qui conçoit et livre des sites web, applications et outils IA performants pour les marques ambitieuses.",
      ogDescription: "Expériences web conçues pour les marques ambitieuses.",
    },
    about: {
      title: "Studio — WebXIA",
      description:
        "WebXIA est un studio digital spécialisé dans le web, l'IA et l'automatisation pour accompagner les entreprises dans leur transformation numérique.",
      ogDescription: "Agence digitale spécialisée dans le web, l'IA et l'automatisation.",
    },
    services: {
      title: "Services — WebXIA",
      description:
        "Création web, branding, SEO, développement sur mesure, intégration IA et croissance — une équipe focus pour des projets ambitieux.",
      ogDescription: "De la stratégie au lancement — design, développement, IA, croissance.",
    },
    contact: {
      title: "Contact — WebXIA",
      description:
        "Parlez-nous de votre projet. Nous répondons sous un jour ouvré, ou réservez un appel de 30 minutes.",
      ogDescription: "Parlez-nous de votre projet.",
    },
    journal: {
      title: "Journal — WebXIA",
      description: "Articles, études de cas et actualités du studio WebXIA.",
      ogDescription: "Notes de terrain du studio.",
    },
    cgu: {
      title: "Conditions Générales d'Utilisation — WebXIA",
      description:
        "Conditions générales d'utilisation du site webxia.fr — accès au site, propriété intellectuelle, prestations et responsabilités.",
      ogDescription: "Conditions générales d'utilisation de webxia.fr.",
    },
    mentionsLegales: {
      title: "Mentions Légales — WebXIA",
      description:
        "Mentions légales du site webxia.fr — identité de l'éditeur, hébergeur et propriété intellectuelle.",
      ogDescription: "Mentions légales du site webxia.fr.",
    },
    politiqueConfidentialite: {
      title: "Politique de Confidentialité — WebXIA",
      description:
        "Politique de confidentialité de WebXIA — comment nous collectons, utilisons et protégeons vos données personnelles conformément au RGPD.",
      ogDescription: "Politique de confidentialité de WebXIA — données personnelles et RGPD.",
    },
  },
  en: {
    home: {
      title: "WebXIA — Premium web & AI studio",
      description:
        "WebXIA is a senior product team designing and shipping high-performance websites, applications and AI tooling for ambitious brands.",
      ogDescription: "Engineered web experiences for ambitious brands.",
    },
    about: {
      title: "About — WebXIA",
      description: "A small, senior digital team obsessed with craft, design, development and AI.",
      ogDescription: "A senior digital team obsessed with craft and outcomes.",
    },
    services: {
      title: "Services — WebXIA",
      description:
        "Web design, branding, SEO, custom development, AI integration and growth — a focused team for ambitious projects.",
      ogDescription: "From strategy to launch — design, development, AI, growth.",
    },
    contact: {
      title: "Contact — WebXIA",
      description:
        "Tell us about your project. We reply within one business day, or book a 30-min intro call.",
      ogDescription: "Tell us about your project.",
    },
    journal: {
      title: "Journal — WebXIA",
      description: "Articles, case studies and news from the WebXIA studio.",
      ogDescription: "Field notes from the studio.",
    },
    cgu: {
      title: "Terms and Conditions — WebXIA",
      description:
        "Terms and conditions of using webxia.fr — site access, intellectual property, services and liability.",
      ogDescription: "Terms and conditions of webxia.fr.",
    },
    mentionsLegales: {
      title: "Legal Notice — WebXIA",
      description:
        "Legal notice for webxia.fr — publisher identity, hosting provider and intellectual property.",
      ogDescription: "Legal notice for webxia.fr.",
    },
    politiqueConfidentialite: {
      title: "Privacy Policy — WebXIA",
      description:
        "WebXIA privacy policy — how we collect, use and protect your personal data in compliance with the GDPR.",
      ogDescription: "Privacy policy — personal data and GDPR.",
    },
  },
};
