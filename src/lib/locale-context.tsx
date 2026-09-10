import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "fr" | "en";

type Dict = Record<string, string>;

const translations: Record<Locale, Dict> = {
  en: {
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.work": "Work",
    "nav.about": "About",
    "nav.journal": "Journal",
    "nav.contact": "Contact",
    "cta.book": "Book a call",
    "cta.start": "Start a project",
    "hero.eyebrow": "WEB · DESIGN · IA · AUTOMATISATION",
    "hero.title": "We create the digital tools that grow your business.",
    "hero.subtitle":
      "WebXIA helps businesses with modern websites, custom digital experiences, and AI solutions designed to simplify their daily operations.",
    "hero.primary": "Start a project",
    "hero.secondary": "Discover WebXIA",
    "services.eyebrow": "Capabilities",
    "services.title": "A focused team. Four sharp services.",
    "services.subtitle":
      "We operate as your in-house product squad — from strategy to launch, with the obsession of a craft studio.",
    "service.1.title": "Web Design & Brand",
    "service.1.desc":
      "Editorial design systems, motion, and brand identities built for the screen.",
    "service.2.title": "Web & App Development",
    "service.2.desc":
      "Next-gen React, TanStack and edge architectures. Lightning fast, type safe, scalable.",
    "service.3.title": "AI Integration",
    "service.3.desc":
      "Custom agents, RAG pipelines and AI features that move metrics, not just demos.",
    "service.4.title": "Growth & SEO",
    "service.4.desc":
      "Technical SEO, analytics and conversion engineering to compound your traffic.",
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
    "footer.brand.description":
      "Digital studio specialized in web creation, branding, SEO, custom development and AI solutions.",
    "footer.social.label": "Follow us",
    "footer.nav.title": "Navigation",
    "footer.nav.home": "Home",
    "footer.nav.services": "Services",
    "footer.nav.studio": "The Studio",
    "footer.nav.method": "Our Method",
    "footer.nav.work": "Work",
    "footer.nav.contact": "Contact",
    "footer.solutions.title": "Solutions",
    "footer.solutions.web": "Web Creation",
    "footer.solutions.branding": "Branding",
    "footer.solutions.seo": "SEO",
    "footer.solutions.ai": "AI & Automation",
    "footer.solutions.dev": "Custom Development",
    "footer.solutions.maintenance": "Maintenance",
    "footer.contact.title": "Contact",
    "footer.contact.address": "Bordeaux, France",
    "footer.contact.email": "contact@webxia.fr",
    "footer.contact.phone": "+33 5 00 00 00 00",
    "footer.legal.title": "Legal",
    "footer.legal.mentions": "Legal Notice",
    "footer.legal.privacy": "Privacy Policy",
    "footer.legal.terms": "Terms of Use",
    "footer.madeby": "Designed and developed by WebXIA",
    "floating.cta": "Let's talk",

    "chat.widget.title": "Chat with Webi",
    "chat.widget.subtitle": "Your AI assistant",
    "chat.input.placeholder": "Ask your question…",
    "chat.input.send": "Send",
    "chat.typing": "Webi is typing…",
    "chat.tool.search_knowledge": "Webi searching knowledge base…",
    "chat.tool.summarize": "Webi summarizing…",
    "chat.tool.executing": "Webi executing…",
    "chat.tool.result": "Tool result",
    "chat.error.generic": "An error occurred. Please try again.",
    "chat.error.rate_limit": "Too many requests. Contact us to continue.",
    "chat.error.unavailable": "Service temporarily unavailable.",
    "chat.reset": "New conversation",
    "chat.close": "Close",
    "chat.contact.cta": "Talk to a human",
    "chat.contact.description": "Need personalized help? Contact our team.",
    "chat.limit.remaining": "messages remaining",
    "chat.limit.reached": "Message limit reached",
    "chat.limit.description": "You have reached the message limit for this session.",
    "chat.citations.title": "Sources ({count})",
    "chat.empty": "Start a conversation with Webi",
    "work.eyebrow": "Selected work",
    "work.title": "Products we shipped. Outcomes we own.",
    "work.subtitle": "A selection of recent engagements across web, app, AI and brand.",
    "work.filter.all": "All",
    "work.filter.web": "Web",
    "work.filter.app": "App",
    "work.filter.ai": "AI",
    "work.filter.brand": "Brand",

    "about.eyebrow": "The studio",
    "about.title": "A small, senior team — obsessed with craft and outcomes.",
    "about.subtitle":
      "We operate as your in-house product squad: strategy, design, engineering, AI. No layers, no handoffs.",
    "about.manifesto.title": "Our manifesto",
    "about.manifesto.body":
      "WebXIA exists because most digital work is average. We're built for teams who refuse it — who measure success in shipped products, real users, and compounding revenue.",
    "about.values.title": "What we believe",
    "about.values.1.title": "Craft is leverage",
    "about.values.1.desc":
      "Detail compounds. The 1% on every surface is the difference between forgettable and inevitable.",
    "about.values.2.title": "Ship to learn",
    "about.values.2.desc":
      "We deploy in weeks, not quarters. Real users teach faster than any roadmap.",
    "about.values.3.title": "Few clients, deep work",
    "about.values.3.desc":
      "We take on a handful of partners per quarter. You get our best people, not a junior team.",
    "about.values.4.title": "Honest by default",
    "about.values.4.desc":
      "Fixed scope, transparent pricing, no surprise invoices. Hard conversations early, never late.",
    "about.team.title": "The team",
    "about.process.title": "How we work",
    "about.process.1.title": "Discovery",
    "about.process.1.desc":
      "One week. We align on goals, audience, constraints and success metrics.",
    "about.process.2.title": "Design",
    "about.process.2.desc":
      "Editorial design system, motion, prototype. Validated with real users.",
    "about.process.3.title": "Build",
    "about.process.3.desc":
      "Production code from week one. TypeScript, edge runtime, type-safe end to end.",
    "about.process.4.title": "Launch & grow",
    "about.process.4.desc": "We don't disappear at launch. Analytics, SEO and iteration baked in.",
    "about.stack.title": "Our default stack",
    "about.location": "Paris · Remote within ±3h",

    "journal.eyebrow": "Journal",
    "journal.title": "Articles, case studies, news.",
    "journal.subtitle":
      "Field notes from the studio — what we're shipping, learning and hiring for.",
    "journal.filter.all": "All",
    "journal.filter.article": "Articles",
    "journal.filter.case-study": "Case studies",
    "journal.filter.news": "News",
    "journal.readMore": "Read article",
    "journal.minutes": "min read",
    "journal.back": "Back to journal",
    "journal.related": "Keep reading",

    "home.work.eyebrow": "Selected work",
    "home.work.title": "A few recent products.",
    "home.work.cta": "See all work",
    "home.services.cta": "See all services",
    "home.cta.title": "Have a project in mind?",
    "home.cta.body": "We reply within one business day. Tell us about your scope and timeline.",
    "home.cta.button": "Start a project",
    "home.problemSolution.eyebrow": "Before / After",
    "home.problemSolution.title": "Your business evolves. Your tools must evolve too.",
    "home.problemSolution.subtitle":
      "Your website, your tools and your visibility must work for you. At WebXIA, we turn digital into a true growth engine.",
    "home.problemSolution.challenges.title": "Challenges many businesses face",
    "home.problemSolution.challenges.1": "A website that doesn't generate new clients.",
    "home.problemSolution.challenges.2": "Too many repetitive tasks.",
    "home.problemSolution.challenges.3": "Insufficient visibility on Google.",
    "home.problemSolution.challenges.4": "Tools that don't communicate with each other.",
    "home.problemSolution.solutions.title":
      "WebXIA transforms these challenges\ninto opportunities",
    "home.problemSolution.solutions.1": "A professional digital presence.",
    "home.problemSolution.solutions.2": "Smart automations.",
    "home.problemSolution.solutions.3": "Better visibility on Google.",
    "home.problemSolution.solutions.4": "Solutions tailored to your business.",
    "home.problemSolution.cta": "Explore our services",
    "home.problemSolution.ctaLeft": "Discover our solutions",
    "home.expertises.eyebrow": "OUR EXPERTISES",
    "home.expertises.title": "Digital solutions designed to support every stage of your growth.",
    "home.expertises.subtitle":
      "From building your identity to automating your processes, WebXIA brings together all the skills needed to deliver high-performing, scalable solutions tailored to your business.",
    "home.expertises.1.title": "Web Design",
    "home.expertises.1.hook": "Give your business an online presence that inspires trust.",
    "home.expertises.1.desc":
      "Showcase sites, e-commerce, landing pages and custom platforms designed to turn visitors into clients.",
    "home.expertises.2.title": "Branding & Visual Identity",
    "home.expertises.2.hook": "Stand out from the very first glance.",
    "home.expertises.2.desc":
      "Logo, graphic guidelines, modern interfaces and a cohesive visual world to strengthen your brand image.",
    "home.expertises.3.title": "SEO & Acquisition",
    "home.expertises.3.hook": "Grow your visibility and attract new clients.",
    "home.expertises.3.desc":
      "SEO, local SEO, Google Business Profile and digital strategies to improve your presence on Google long-term.",
    "home.expertises.4.title": "AI & Automation",
    "home.expertises.4.hook": "Save time with smart tools.",
    "home.expertises.4.desc":
      "AI agents, chatbots, automations, workflows and integrations to simplify your daily operations.",
    "home.expertises.5.title": "Custom Development",
    "home.expertises.5.hook": "Solutions that adapt to your business.",
    "home.expertises.5.desc":
      "Web apps, custom tools, client portals, APIs and tailored features built to your needs.",
    "home.expertises.6.title": "Consulting & Strategy",
    "home.expertises.6.hook": "Let's build your digital roadmap together.",
    "home.expertises.6.desc":
      "Audit, support and digital strategy to help your business evolve sustainably.",
    "home.expertises.7.title": "Maintenance & Evolution",
    "home.expertises.7.hook": "Support that continues after launch.",
    "home.expertises.7.desc":
      "Maintenance, security, hosting, support and ongoing optimisations to ensure your tools stay performant.",
    "home.expertises.cta": "Discover all our services",
    "home.whyChooseUs.eyebrow": "WHY CHOOSE US",
    "home.whyChooseUs.title": "Why choose WebXIA?",
    "home.whyChooseUs.subtitle": "A digital agency that supports your growth.",
    "home.whyChooseUs.body":
      "At WebXIA, we don't just build websites. We deliver complete digital solutions combining design, development, marketing, automation and AI to help businesses improve their visibility, efficiency and performance.",
    "home.whyChooseUs.engagementsTitle": "Our commitments",
    "home.whyChooseUs.1": "A 100% personalised approach",
    "home.whyChooseUs.2": "Modern, scalable solutions",
    "home.whyChooseUs.3": "A single point of contact",
    "home.whyChooseUs.4": "Cutting-edge technologies",
    "home.whyChooseUs.5": "Optimised performance",
    "home.whyChooseUs.6": "Human support at every step",
    "home.whyChooseUs.7": "Measurable results",
    "home.whyChooseUs.8": "A trusted long-term partner",
    "home.whyChooseUs.cta": "Request a free quote",

    "contact.form.title": "Send us a message",
    "contact.form.hint": "We'll get back to you within one business day.",

    "booking.title": "Book an appointment",
    "booking.subtitle": "Schedule a meeting in just a few clicks",

    "services.learnMore": "Learn more",
    "services.engagements": "Our commitments",

    "about.team.body":
      "Around Mehdi E., WebXIA operates as a flexible digital studio: a team of specialists mobilized according to each project's needs, with no unnecessary intermediaries.",
    "about.team.photoAlt": "Photo of Mehdi E.",

    "error.404.title": "Page not found",
    "error.404.description": "The page you're looking for doesn't exist or has been moved.",
    "error.404.cta": "Go home",
    "error.500.title": "This page didn't load",
    "error.500.description":
      "Something went wrong on our end. You can try refreshing or head back home.",
    "error.500.tryAgain": "Try again",
    "error.500.cta": "Go home",

    "seo.home.title": "WebXIA — Premium web & AI studio",
    "seo.home.description":
      "WebXIA is a senior product team designing and shipping high-performance websites, applications and AI tooling for ambitious brands.",
    "seo.about.title": "About — WebXIA",
    "seo.about.description":
      "A small, senior digital team obsessed with craft, design, development and AI.",
    "seo.services.title": "Services — WebXIA",
    "seo.services.description":
      "Web design, branding, SEO, custom development, AI integration and growth — a focused team for ambitious projects.",
    "seo.contact.title": "Contact — WebXIA",
    "seo.contact.description": "Tell us about your project. We reply within one business day.",
    "seo.journal.title": "Journal — WebXIA",
    "seo.journal.description": "Articles, case studies and news from the WebXIA studio.",

    "team.founder.role": "Founder · WebXIA",
    "team.founder.bio":
      "Passionate about digital, web development and new technologies, Mehdi helps businesses in their digital transformation by combining strategy, design, development and artificial intelligence.",
    "team.poles.1.title": "Development & Technology",
    "team.poles.1.desc":
      "Websites, applications and business tools built with modern, high-performance and scalable technologies.",
    "team.poles.2.title": "Design & Identity",
    "team.poles.2.desc":
      "Visual worlds, modern interfaces and digital experiences consistent with your brand image.",
    "team.poles.3.title": "AI & Automation",
    "team.poles.3.desc":
      "Intelligent solutions, AI agents and automations to simplify your business processes.",
    "team.poles.4.title": "Digital Marketing",
    "team.poles.4.desc":
      "SEO, local visibility and digital strategies to grow your online presence and attract new clients.",

    "status.all": "All",
    "status.draft": "Draft",
    "status.published": "Published",
    "status.archived": "Archived",

    "form.budget.none": "—",
    "form.budget.low": "< 10k €",
    "form.budget.mid": "10k – 30k €",
    "form.budget.high": "30k – 80k €",
    "form.budget.vhigh": "80k+ €",

    "expertises.marquee.1.title": "Web Design",
    "expertises.marquee.1.desc": "High-performance websites & digital experiences",
    "expertises.marquee.2.title": "Branding",
    "expertises.marquee.2.desc": "Visual identity & brand world",
    "expertises.marquee.3.title": "SEO",
    "expertises.marquee.3.desc": "Google visibility & digital acquisition",
    "expertises.marquee.4.title": "AI & Automation",
    "expertises.marquee.4.desc": "Smart solutions to save time",
    "expertises.marquee.5.title": "Custom Development",
    "expertises.marquee.5.desc": "Digital tools tailored to your needs",
    "expertises.marquee.6.title": "Maintenance",
    "expertises.marquee.6.desc": "Support, security & continuous evolution",

    "journal.article.notFound": "Article not found",
    "journal.article.backToJournal": "Back to journal",

    "admin.nav.dashboard": "Dashboard",
    "admin.nav.articles": "Articles",
    "admin.nav.realisations": "Projects",
    "admin.nav.aiMemory": "AI Memory",
    "admin.nav.logout": "Logout",
    "admin.nav.administration": "Administration",
    "admin.dashboard.title": "Overview",
    "admin.dashboard.newArticle": "New article",
    "admin.dashboard.newProject": "New project",
    "admin.dashboard.quickStats": "Quick stats",
    "admin.dashboard.totalArticles": "Total articles",
    "admin.dashboard.totalProjects": "Total projects",
    "admin.dashboard.publishedArticles": "Published",
    "admin.dashboard.draftArticles": "Drafts",
    "admin.articles.title": "Articles",
    "admin.articles.new": "New article",
    "admin.articles.search": "Search...",
    "admin.articles.filters": "Filters",
    "admin.articles.colTitle": "Title",
    "admin.articles.colStatus": "Status",
    "admin.articles.colCreated": "Created",
    "admin.articles.colActions": "Actions",
    "admin.articles.loading": "Loading...",
    "admin.articles.empty": "No articles found.",
    "admin.articles.prev": "Previous",
    "admin.articles.next": "Next",
    "admin.articles.deleteConfirm": "Are you sure?",
    "admin.articles.deleteDesc": "This action cannot be undone.",
    "admin.articles.deleteCancel": "Cancel",
    "admin.articles.deleteAction": "Delete",
    "admin.realisations.title": "Projects",
    "admin.realisations.new": "New project",
    "admin.realisations.search": "Search...",
    "admin.realisations.filters": "Filters",
    "admin.realisations.colProject": "Project",
    "admin.realisations.colStatus": "Status",
    "admin.realisations.colClient": "Client",
    "admin.realisations.colOrder": "Order",
    "admin.realisations.colActions": "Actions",
    "admin.realisations.loading": "Loading...",
    "admin.realisations.empty": "No projects found.",
    "admin.realisations.prev": "Previous",
    "admin.realisations.next": "Next",
    "admin.realisations.deleteConfirm": "Are you sure?",
    "admin.realisations.deleteDesc": "This action cannot be undone.",
    "admin.realisations.deleteCancel": "Cancel",
    "admin.realisations.deleteAction": "Delete",
    "admin.aiMemory.title": "AI Memory",
    "admin.aiMemory.subtitle": "Manage persistent AI data",
    "admin.aiMemory.all": "All",
    "admin.aiMemory.conversation": "Conversation",
    "admin.aiMemory.context": "Context",
    "admin.aiMemory.loading": "Loading...",
    "admin.aiMemory.empty": "No memories found.",
    "admin.aiMemory.deleteConfirm": "Are you sure?",
    "admin.aiMemory.deleteDesc": "This will permanently delete this memory.",
    "admin.aiMemory.deleteCancel": "Cancel",
    "admin.aiMemory.deleteAction": "Delete",
    "admin.login.title": "Sign in",
    "admin.login.email": "Email",
    "admin.login.password": "Password",
    "admin.login.submit": "Sign in",
    "admin.login.loading": "Signing in...",
    "admin.login.error": "Invalid credentials.",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.services": "Services",
    "nav.work": "Réalisations",
    "nav.about": "Studio",
    "nav.journal": "Journal",
    "nav.contact": "Contact",
    "cta.book": "Réserver un appel",
    "cta.start": "Lancer un projet",
    "hero.eyebrow": "WEB · DESIGN · IA · AUTOMATISATION",
    "hero.title": "Nous créons les outils digitaux qui font évoluer votre entreprise.",
    "hero.subtitle":
      "WebXIA accompagne les entreprises avec des sites modernes, des expériences digitales sur mesure et des solutions IA conçues pour simplifier leur quotidien.",
    "hero.primary": "Démarrer un projet",
    "hero.secondary": "Découvrir WebXIA",
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
    "service.4.desc":
      "SEO technique, analytics et optimisation de conversion pour cumuler le trafic.",
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
    "footer.brand.description":
      "Studio digital spécialisé dans la création de sites web, le branding, le référencement, le développement sur mesure et les solutions d'intelligence artificielle.",
    "footer.social.label": "Suivez-nous",
    "footer.nav.title": "Navigation",
    "footer.nav.home": "Accueil",
    "footer.nav.services": "Services",
    "footer.nav.studio": "Le Studio",
    "footer.nav.method": "Notre méthode",
    "footer.nav.work": "Réalisations",
    "footer.nav.contact": "Contact",
    "footer.solutions.title": "Solutions",
    "footer.solutions.web": "Création Web",
    "footer.solutions.branding": "Branding",
    "footer.solutions.seo": "SEO",
    "footer.solutions.ai": "IA & Automatisation",
    "footer.solutions.dev": "Développement sur mesure",
    "footer.solutions.maintenance": "Maintenance",
    "footer.contact.title": "Contact",
    "footer.contact.address": "Bordeaux, France",
    "footer.contact.email": "contact@webxia.fr",
    "footer.contact.phone": "+33 5 00 00 00 00",
    "footer.legal.title": "Mentions légales",
    "footer.legal.mentions": "Mentions légales",
    "footer.legal.privacy": "Politique de confidentialité",
    "footer.legal.terms": "Conditions générales d'utilisation",
    "footer.madeby": "Conçu et développé par WebXIA",
    "floating.cta": "Discutons",

    "chat.widget.title": "Discutez avec Webi",
    "chat.widget.subtitle": "Votre assistant IA",
    "chat.input.placeholder": "Posez votre question…",
    "chat.input.send": "Envoyer",
    "chat.typing": "Webi écrit…",
    "chat.tool.search_knowledge": "Webi recherche dans ses connaissances…",
    "chat.tool.summarize": "Webi résume…",
    "chat.tool.executing": "Webi exécute…",
    "chat.tool.result": "Résultat de l'outil",
    "chat.error.generic": "Une erreur est survenue. Réessayez.",
    "chat.error.rate_limit": "Trop de requêtes. Contactez-nous pour continuer.",
    "chat.error.unavailable": "Service temporairement indisponible.",
    "chat.reset": "Nouvelle conversation",
    "chat.close": "Fermer",
    "chat.contact.cta": "Parler à un humain",
    "chat.contact.description": "Besoin d'aide personnalisée ? Contactez notre équipe.",
    "chat.limit.remaining": "messages restants",
    "chat.limit.reached": "Limite de messages atteinte",
    "chat.limit.description": "Vous avez atteint la limite de messages pour cette session.",
    "chat.citations.title": "Sources ({count})",
    "chat.empty": "Commencez une conversation avec Webi",
    "work.eyebrow": "Réalisations",
    "work.title": "Des produits livrés. Des résultats assumés.",
    "work.subtitle": "Une sélection de projets récents — web, app, IA et identité.",
    "work.filter.all": "Tous",
    "work.filter.web": "Web",
    "work.filter.app": "App",
    "work.filter.ai": "IA",
    "work.filter.brand": "Identité",

    "about.eyebrow": "Le studio",
    "about.title":
      "Une équipe digitale experte — dédiée à créer des solutions qui font grandir votre entreprise.",
    "about.subtitle":
      "Nous accompagnons les entreprises dans leur transformation digitale grâce au design, au développement web, au référencement et à l'intelligence artificielle.",
    "about.manifesto.title": "Notre manifeste",
    "about.manifesto.body":
      "WebXIA existe avec une conviction simple : la technologie doit rester accessible, utile et performante.\n\nNous créons des expériences digitales qui ne se contentent pas d'être belles. Elles doivent aider les entreprises à gagner en visibilité, automatiser leur quotidien et développer leur activité.",
    "about.values.title": "Nos convictions",
    "about.values.1.title": "La qualité avant la quantité",
    "about.values.1.desc":
      "Nous privilégions des collaborations où nous pouvons réellement apporter de la valeur. Chaque détail compte : design, performance, expérience utilisateur et résultats.",
    "about.values.2.title": "Créer du concret",
    "about.values.2.desc":
      "Nous avançons rapidement avec une approche orientée résultat. Des premières maquettes au lancement, chaque étape est pensée pour créer un impact réel.",
    "about.values.3.title": "L'IA comme accélérateur",
    "about.values.3.desc":
      "L'intelligence artificielle n'est pas une tendance : c'est un outil puissant pour automatiser, optimiser et créer de nouvelles opportunités.",
    "about.values.4.title": "Une relation transparente",
    "about.values.4.desc":
      "Des objectifs clairs, une communication simple et aucun intermédiaire inutile. Vous échangez directement avec les personnes impliquées dans votre projet.",
    "about.team.title": "L'équipe",
    "about.process.title": "Notre méthode",
    "about.process.subtitle":
      "Une approche simple, transparente et orientée résultats pour transformer vos idées en solutions digitales performantes.",
    "about.process.1.title": "Cadrage",
    "about.process.1.desc":
      "Nous analysons votre activité, vos objectifs et vos besoins afin de construire une solution adaptée à votre entreprise.",
    "about.process.2.title": "Design",
    "about.process.2.desc":
      "Nous concevons une expérience digitale moderne, intuitive et cohérente avec votre image de marque.",
    "about.process.3.title": "Développement",
    "about.process.3.desc":
      "Nous créons des solutions performantes et évolutives avec des technologies modernes adaptées à vos besoins.",
    "about.process.4.title": "Lancement & évolution",
    "about.process.4.desc":
      "Nous vous accompagnons après la mise en ligne pour optimiser, améliorer et faire évoluer votre projet dans le temps.",
    "about.stack.title": "Notre stack par défaut",
    "about.location": "Bordeaux · France · Remote",

    "journal.eyebrow": "Journal",
    "journal.title": "Articles, études de cas, actualités.",
    "journal.subtitle": "Notes de terrain du studio — ce que nous livrons, apprenons et recrutons.",
    "journal.filter.all": "Tous",
    "journal.filter.article": "Articles",
    "journal.filter.case-study": "Études de cas",
    "journal.filter.news": "Actualités",
    "journal.readMore": "Lire l'article",
    "journal.minutes": "min de lecture",
    "journal.back": "Retour au journal",
    "journal.related": "Lire aussi",

    "home.work.eyebrow": "Projets récents",
    "home.work.title": "Quelques produits récents.",
    "home.work.cta": "Voir tous les projets",
    "home.services.cta": "Voir tous les services",
    "home.cta.title": "Vous avez un projet en tête ?",
    "home.cta.body":
      "Nous répondons sous un jour ouvré. Décrivez votre périmètre et votre calendrier.",
    "home.cta.button": "Lancer un projet",
    "home.problemSolution.eyebrow": "Avant / Après",
    "home.problemSolution.title": "Votre entreprise évolue.\nVos outils doivent évoluer aussi.",
    "home.problemSolution.subtitle":
      "Votre site internet, vos outils et votre visibilité doivent travailler pour vous. Chez WebXIA, nous transformons le digital en un véritable moteur de croissance.",
    "home.problemSolution.challenges.title": "Les défis que rencontrent de nombreuses entreprises",
    "home.problemSolution.challenges.1": "Un site qui ne génère pas de nouveaux clients.",
    "home.problemSolution.challenges.2": "Trop de tâches répétitives.",
    "home.problemSolution.challenges.3": "Une visibilité insuffisante sur Google.",
    "home.problemSolution.challenges.4": "Des outils qui ne communiquent pas entre eux.",
    "home.problemSolution.solutions.title": "WebXIA transforme ces défis\nen opportunités",
    "home.problemSolution.solutions.1": "Une présence digitale professionnelle.",
    "home.problemSolution.solutions.2": "Des automatisations intelligentes.",
    "home.problemSolution.solutions.3": "Une meilleure visibilité sur Google.",
    "home.problemSolution.solutions.4": "Des solutions adaptées à votre activité.",
    "home.problemSolution.cta": "Explorer nos services",
    "home.problemSolution.ctaLeft": "Découvrir nos solutions",
    "home.expertises.eyebrow": "NOS EXPERTISES",
    "home.expertises.title":
      "Des solutions digitales conçues pour accompagner chaque étape de votre développement.",
    "home.expertises.subtitle":
      "De la création de votre identité à l'automatisation de vos processus, WebXIA réunit toutes les compétences nécessaires pour concevoir des solutions performantes, évolutives et adaptées à votre activité.",
    "home.expertises.1.title": "Création de sites web",
    "home.expertises.1.hook":
      "Donnez à votre entreprise une présence en ligne qui inspire confiance.",
    "home.expertises.1.desc":
      "Sites vitrines, e-commerce, landing pages et plateformes sur mesure conçus pour convertir vos visiteurs en clients.",
    "home.expertises.2.title": "Branding & Identité visuelle",
    "home.expertises.2.hook": "Faites la différence dès le premier regard.",
    "home.expertises.2.desc":
      "Logo, charte graphique, interfaces modernes et univers visuel cohérent pour renforcer votre image de marque.",
    "home.expertises.3.title": "SEO & Acquisition",
    "home.expertises.3.hook": "Développez votre visibilité et attirez de nouveaux clients.",
    "home.expertises.3.desc":
      "SEO, SEO local, Google Business Profile et stratégies digitales pour améliorer durablement votre présence sur Google.",
    "home.expertises.4.title": "IA & Automatisation",
    "home.expertises.4.hook": "Gagnez du temps grâce à des outils intelligents.",
    "home.expertises.4.desc":
      "Agents IA, chatbots, automatisations, workflows et intégrations pour simplifier votre quotidien.",
    "home.expertises.5.title": "Développement sur mesure",
    "home.expertises.5.hook": "Des solutions qui s'adaptent à votre métier.",
    "home.expertises.5.desc":
      "Applications web, outils métiers, espaces clients, API et fonctionnalités personnalisées selon vos besoins.",
    "home.expertises.6.title": "Conseil & Stratégie",
    "home.expertises.6.hook": "Construisons ensemble votre feuille de route digitale.",
    "home.expertises.6.desc":
      "Audit, accompagnement et stratégie digitale pour faire évoluer durablement votre entreprise.",
    "home.expertises.7.title": "Maintenance & Évolution",
    "home.expertises.7.hook": "Un accompagnement qui continue après la mise en ligne.",
    "home.expertises.7.desc":
      "Maintenance, sécurité, hébergement, assistance et optimisations continues pour garantir la performance de vos outils.",
    "home.expertises.cta": "Découvrir tous nos services",
    "home.whyChooseUs.eyebrow": "POURQUOI NOUS CHOISIR",
    "home.whyChooseUs.title": "Pourquoi choisir WebXIA ?",
    "home.whyChooseUs.subtitle": "Une agence digitale qui accompagne votre croissance.",
    "home.whyChooseUs.body":
      "Chez WebXIA, nous ne nous contentons pas de créer des sites internet. Nous concevons des solutions digitales complètes qui allient design, développement, marketing, automatisation et intelligence artificielle pour aider les entreprises à gagner en visibilité, en efficacité et en performance.",
    "home.whyChooseUs.engagementsTitle": "Nos engagements",
    "home.whyChooseUs.1": "Une approche 100 % personnalisée",
    "home.whyChooseUs.2": "Des solutions modernes et évolutives",
    "home.whyChooseUs.3": "Un interlocuteur unique",
    "home.whyChooseUs.4": "Des technologies de dernière génération",
    "home.whyChooseUs.5": "Des performances optimisées",
    "home.whyChooseUs.6": "Un accompagnement humain à chaque étape",
    "home.whyChooseUs.7": "Des résultats mesurables",
    "home.whyChooseUs.8": "Un partenaire de confiance sur le long terme",
    "home.whyChooseUs.cta": "Demander un devis gratuit",

    "contact.form.title": "Envoyez-nous un message",
    "contact.form.hint": "Nous vous répondrons dans les plus brefs délais.",

    "booking.title": "Prendre rendez-vous",
    "booking.subtitle": "Réservez un rendez-vous en quelques clics",

    "services.learnMore": "En savoir plus",
    "services.engagements": "Nos engagements",

    "about.team.body":
      "Autour de Mehdi E., WebXIA fonctionne comme un studio digital flexible : une équipe de spécialistes mobilisée selon les besoins de chaque projet, sans intermédiaires inutiles.",
    "about.team.photoAlt": "Photo de Mehdi E.",

    "error.404.title": "Page introuvable",
    "error.404.description": "La page que vous recherchez n'existe pas ou a été déplacée.",
    "error.404.cta": "Retour à l'accueil",
    "error.500.title": "Cette page n'a pas pu se charger",
    "error.500.description":
      "Une erreur s'est produite de notre côté. Vous pouvez réessayer ou revenir à l'accueil.",
    "error.500.tryAgain": "Réessayer",
    "error.500.cta": "Retour à l'accueil",

    "seo.home.title": "WebXIA — Studio web & IA premium",
    "seo.home.description":
      "WebXIA est une équipe produit senior qui conçoit et livre des sites web, applications et outils IA performants pour les marques ambitieuses.",
    "seo.about.title": "Studio — WebXIA",
    "seo.about.description":
      "Une petite équipe digitale experte, dédiée au craft, au design, au développement et à l'IA.",
    "seo.services.title": "Services — WebXIA",
    "seo.services.description":
      "Création web, branding, SEO, développement sur mesure, intégration IA et croissance — une équipe focus pour des projets ambitieux.",
    "seo.contact.title": "Contact — WebXIA",
    "seo.contact.description": "Parlez-nous de votre projet. Nous répondons sous un jour ouvré.",
    "seo.journal.title": "Journal — WebXIA",
    "seo.journal.description": "Articles, études de cas et actualités du studio WebXIA.",

    "team.founder.role": "Fondateur · WebXIA",
    "team.founder.bio":
      "Passionné par le digital, le développement web et les nouvelles technologies, Mehdi accompagne les entreprises dans leur transformation numérique en combinant stratégie, design, développement et intelligence artificielle.",
    "team.poles.1.title": "Développement & Technologie",
    "team.poles.1.desc":
      "Création de sites web, applications et outils métiers avec des technologies modernes, performantes et évolutives.",
    "team.poles.2.title": "Design & Identité",
    "team.poles.2.desc":
      "Création d'univers visuels, interfaces modernes et expériences digitales cohérentes avec votre image de marque.",
    "team.poles.3.title": "IA & Automatisation",
    "team.poles.3.desc":
      "Déploiement de solutions intelligentes, agents IA et automatisations pour simplifier vos processus métier.",
    "team.poles.4.title": "Marketing Digital",
    "team.poles.4.desc":
      "SEO, visibilité locale et stratégies digitales pour développer votre présence en ligne et attirer de nouveaux clients.",

    "status.all": "Tous",
    "status.draft": "Brouillon",
    "status.published": "Publié",
    "status.archived": "Archivé",

    "form.budget.none": "—",
    "form.budget.low": "< 10k €",
    "form.budget.mid": "10k – 30k €",
    "form.budget.high": "30k – 80k €",
    "form.budget.vhigh": "80k+ €",

    "expertises.marquee.1.title": "Création Web",
    "expertises.marquee.1.desc": "Sites internet performants & expériences digitales",
    "expertises.marquee.2.title": "Branding",
    "expertises.marquee.2.desc": "Identité visuelle & univers de marque",
    "expertises.marquee.3.title": "SEO",
    "expertises.marquee.3.desc": "Visibilité Google & acquisition digitale",
    "expertises.marquee.4.title": "IA & Automatisation",
    "expertises.marquee.4.desc": "Solutions intelligentes pour gagner du temps",
    "expertises.marquee.5.title": "Développement sur mesure",
    "expertises.marquee.5.desc": "Outils digitaux adaptés à vos besoins",
    "expertises.marquee.6.title": "Maintenance",
    "expertises.marquee.6.desc": "Suivi, sécurité & évolution continue",

    "journal.article.notFound": "Article introuvable",
    "journal.article.backToJournal": "Retour au journal",

    "admin.nav.dashboard": "Tableau de bord",
    "admin.nav.articles": "Articles",
    "admin.nav.realisations": "Réalisations",
    "admin.nav.aiMemory": "Mémoire IA",
    "admin.nav.logout": "Déconnexion",
    "admin.nav.administration": "Administration",
    "admin.dashboard.title": "Vue d'ensemble",
    "admin.dashboard.newArticle": "Nouvel article",
    "admin.dashboard.newProject": "Nouvelle réalisation",
    "admin.dashboard.quickStats": "Statistiques rapides",
    "admin.dashboard.totalArticles": "Total articles",
    "admin.dashboard.totalProjects": "Total réalisations",
    "admin.dashboard.publishedArticles": "Publiés",
    "admin.dashboard.draftArticles": "Brouillons",
    "admin.articles.title": "Articles",
    "admin.articles.new": "Nouvel article",
    "admin.articles.search": "Rechercher...",
    "admin.articles.filters": "Filtres",
    "admin.articles.colTitle": "Titre",
    "admin.articles.colStatus": "Statut",
    "admin.articles.colCreated": "Créé le",
    "admin.articles.colActions": "Actions",
    "admin.articles.loading": "Chargement...",
    "admin.articles.empty": "Aucun article trouvé.",
    "admin.articles.prev": "Précédent",
    "admin.articles.next": "Suivant",
    "admin.articles.deleteConfirm": "Êtes-vous sûr ?",
    "admin.articles.deleteDesc": "Cette action est irréversible.",
    "admin.articles.deleteCancel": "Annuler",
    "admin.articles.deleteAction": "Supprimer",
    "admin.realisations.title": "Réalisations",
    "admin.realisations.new": "Nouvelle réalisation",
    "admin.realisations.search": "Rechercher...",
    "admin.realisations.filters": "Filtres",
    "admin.realisations.colProject": "Projet",
    "admin.realisations.colStatus": "Statut",
    "admin.realisations.colClient": "Client",
    "admin.realisations.colOrder": "Ordre",
    "admin.realisations.colActions": "Actions",
    "admin.realisations.loading": "Chargement...",
    "admin.realisations.empty": "Aucune réalisation trouvée.",
    "admin.realisations.prev": "Précédent",
    "admin.realisations.next": "Suivant",
    "admin.realisations.deleteConfirm": "Êtes-vous sûr ?",
    "admin.realisations.deleteDesc": "Cette action est irréversible.",
    "admin.realisations.deleteCancel": "Annuler",
    "admin.realisations.deleteAction": "Supprimer",
    "admin.aiMemory.title": "Mémoire IA",
    "admin.aiMemory.subtitle": "Gérez les données persistantes de l'IA",
    "admin.aiMemory.all": "Toutes",
    "admin.aiMemory.conversation": "Conversation",
    "admin.aiMemory.context": "Contexte",
    "admin.aiMemory.loading": "Chargement...",
    "admin.aiMemory.empty": "Aucune mémoire trouvée.",
    "admin.aiMemory.deleteConfirm": "Êtes-vous sûr ?",
    "admin.aiMemory.deleteDesc": "Cette mémoire sera définitivement supprimée.",
    "admin.aiMemory.deleteCancel": "Annuler",
    "admin.aiMemory.deleteAction": "Supprimer",
    "admin.login.title": "Connexion",
    "admin.login.email": "Email",
    "admin.login.password": "Mot de passe",
    "admin.login.submit": "Se connecter",
    "admin.login.loading": "Connexion en cours...",
    "admin.login.error": "Identifiants incorrects.",
  },
};

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof typeof translations.en, params?: Record<string, string | number>) => string;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");

  useEffect(() => {
    const stored = (typeof window !== "undefined" &&
      localStorage.getItem("webxia-locale")) as Locale | null;
    if (stored === "fr" || stored === "en") setLocale(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("webxia-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: keyof typeof translations.en, params?: Record<string, string | number>) => {
    let value = translations[locale][key] ?? String(key);
    if (params) {
      for (const [name, val] of Object.entries(params)) {
        value = value.replace(`{${name}}`, String(val));
      }
    }
    return value;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
