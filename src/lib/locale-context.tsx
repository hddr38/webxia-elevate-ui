import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "fr" | "en";

type Dict = Record<string, string>;

const translations: Record<Locale, Dict> = {
  en: {
    "nav.services": "Services",
    "nav.work": "Work",
    "nav.about": "About",
    "nav.journal": "Journal",
    "nav.contact": "Contact",
    "cta.book": "Book a call",
    "cta.start": "Start a project",
    "hero.eyebrow": "Digital studio · Paris / Remote",
    "hero.title": "Engineered web experiences for ambitious brands.",
    "hero.subtitle":
      "WebXIA is a senior product team designing and shipping high-performance websites, applications and AI tooling for companies that refuse the average.",
    "hero.primary": "Start a project",
    "hero.secondary": "See our work",
    "services.eyebrow": "Capabilities",
    "services.title": "A focused team. Four sharp services.",
    "services.subtitle":
      "We operate as your in-house product squad — from strategy to launch, with the obsession of a craft studio.",
    "service.1.title": "Web Design & Brand",
    "service.1.desc": "Editorial design systems, motion, and brand identities built for the screen.",
    "service.2.title": "Web & App Development",
    "service.2.desc": "Next-gen React, TanStack and edge architectures. Lightning fast, type safe, scalable.",
    "service.3.title": "AI Integration",
    "service.3.desc": "Custom agents, RAG pipelines and AI features that move metrics, not just demos.",
    "service.4.title": "Growth & SEO",
    "service.4.desc": "Technical SEO, analytics and conversion engineering to compound your traffic.",
    "contact.eyebrow": "Let's talk",
    "contact.title": "Tell us about your project.",
    "contact.subtitle":
      "We reply within one business day. Prefer to talk? Book a 30-minute intro call directly.",
    "form.name": "Full name",
    "form.email": "Work email",
    "form.company": "Company",
    "form.budget": "Estimated budget",
    "form.message": "Tell us about your project",
    "form.submit": "Send message",
    "form.submitting": "Sending…",
    "form.success": "Message sent. We'll be in touch shortly.",
    "form.calendly": "Book a 30-min call",
    "form.calendlyHint": "Calendly embed will appear here",
    "trust.badge1": "Replies within 24h",
    "trust.badge2": "NDA on request",
    "trust.badge3": "Fixed-scope proposals",
    "footer.tag": "WebXIA · Premium web & AI studio",
    "footer.rights": "All rights reserved.",
    "floating.cta": "Let's talk",
  },
  fr: {
    "nav.services": "Services",
    "nav.work": "Réalisations",
    "nav.about": "Studio",
    "nav.journal": "Journal",
    "nav.contact": "Contact",
    "cta.book": "Réserver un appel",
    "cta.start": "Lancer un projet",
    "hero.eyebrow": "Studio digital · Paris / À distance",
    "hero.title": "Des expériences web d'exception pour les marques ambitieuses.",
    "hero.subtitle":
      "WebXIA est une équipe senior qui conçoit et déploie des sites, applications et solutions IA performantes pour les entreprises qui refusent la moyenne.",
    "hero.primary": "Lancer un projet",
    "hero.secondary": "Voir nos projets",
    "services.eyebrow": "Expertises",
    "services.title": "Une équipe restreinte. Quatre expertises pointues.",
    "services.subtitle":
      "Nous opérons comme votre équipe produit interne — de la stratégie au lancement, avec l'obsession d'un atelier de création.",
    "service.1.title": "Design & Identité",
    "service.1.desc": "Design systems éditoriaux, motion et identités pensés pour l'écran.",
    "service.2.title": "Développement Web & App",
    "service.2.desc": "Architectures React, TanStack et edge. Rapides, typées, scalables.",
    "service.3.title": "Intégration IA",
    "service.3.desc": "Agents sur mesure, pipelines RAG et fonctionnalités IA orientées résultats.",
    "service.4.title": "Croissance & SEO",
    "service.4.desc": "SEO technique, analytics et optimisation de conversion pour cumuler le trafic.",
    "contact.eyebrow": "Discutons",
    "contact.title": "Parlez-nous de votre projet.",
    "contact.subtitle":
      "Nous répondons sous un jour ouvré. Vous préférez échanger de vive voix ? Réservez un appel de 30 minutes.",
    "form.name": "Nom complet",
    "form.email": "Email professionnel",
    "form.company": "Entreprise",
    "form.budget": "Budget estimé",
    "form.message": "Décrivez votre projet",
    "form.submit": "Envoyer le message",
    "form.submitting": "Envoi…",
    "form.success": "Message envoyé. Nous revenons vers vous très vite.",
    "form.calendly": "Réserver 30 min",
    "form.calendlyHint": "L'intégration Calendly apparaîtra ici",
    "trust.badge1": "Réponse sous 24h",
    "trust.badge2": "NDA sur demande",
    "trust.badge3": "Forfaits cadrés",
    "footer.tag": "WebXIA · Studio web & IA premium",
    "footer.rights": "Tous droits réservés.",
    "floating.cta": "Discutons",
  },
};

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof typeof translations.en) => string;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) as Locale | null;
    if (stored === "fr" || stored === "en") setLocale(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("webxia-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: keyof typeof translations.en) => translations[locale][key] ?? String(key);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
