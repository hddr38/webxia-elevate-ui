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
  },
};
