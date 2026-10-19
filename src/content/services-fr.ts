export type ServiceCardData = {
  icon: string;
  title: string;
  description: string;
  bullets: string[];
  tag: string;
};

export type ServiceSectionData = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards?: ServiceCardData[];
  engagements?: string[];
};

export const servicesFr: ServiceSectionData[] = [
  {
    eyebrow: "01 . SITES INTERNET",
    title: "Transformez votre présence en ligne en véritable moteur de croissance.",
    subtitle:
      "Votre site web est souvent le premier contact entre votre entreprise et vos futurs clients. Nous créons des sites rapides, modernes et optimisés pour offrir une expérience utilisateur irréprochable tout en maximisant vos résultats.",
    cards: [
      {
        icon: "Globe",
        title: "Site Vitrine",
        description:
          "Présentez votre entreprise avec un site professionnel qui inspire confiance et met en valeur votre savoir-faire. Un site vitrine bien conçu renforce votre crédibilité, améliore votre visibilité et facilite la prise de contact.",
        bullets: [
          "Design personnalisé à votre image",
          "Compatible ordinateur, tablette et mobile",
          "Pages de présentation optimisées",
          "Formulaire de contact intelligent",
          "Intégration Google Maps",
          "Optimisation des performances",
          "Structure optimisée pour le référencement",
          "Administration simple",
        ],
        tag: "01",
      },
      {
        icon: "CreditCard",
        title: "Site E-commerce",
        description:
          "Développez votre activité grâce à une boutique en ligne performante, sécurisée et pensée pour augmenter vos ventes. Nous créons des expériences d'achat fluides qui rassurent vos clients et favorisent la conversion.",
        bullets: [
          "Boutique entièrement personnalisée",
          "Catalogue produits",
          "Paiement sécurisé",
          "Gestion des stocks",
          "Gestion des commandes",
          "Livraison et transporteurs",
          "Codes promotionnels",
          "Tableau de bord administrateur",
          "Optimisation SEO",
          "Formation à la gestion de la boutique",
        ],
        tag: "02",
      },
      {
        icon: "Palette",
        title: "Refonte de Site",
        description:
          "Votre site est vieillissant ou ne reflète plus votre image ? Nous modernisons votre présence en ligne en améliorant le design, les performances et l'expérience utilisateur tout en conservant vos contenus lorsque cela est possible.",
        bullets: [
          "Refonte graphique complète",
          "Modernisation de l'interface",
          "Optimisation mobile",
          "Amélioration des performances",
          "Optimisation SEO",
          "Migration des contenus",
          "Amélioration de l'expérience utilisateur",
          "Mise aux normes actuelles",
        ],
        tag: "03",
      },
      {
        icon: "Zap",
        title: "Landing Page",
        description:
          "Transformez vos visiteurs en prospects grâce à une page spécialement conçue pour maximiser les conversions lors de vos campagnes publicitaires ou de vos lancements.",
        bullets: [
          "Design orienté conversion",
          "Appels à l'action optimisés",
          "Formulaire de capture",
          "Intégration CRM",
          "Optimisation Google Ads",
          "Compatible Meta Ads",
          "Tracking des conversions",
          "Tests A/B possibles",
        ],
        tag: "04",
      },
      {
        icon: "FileText",
        title: "Site WordPress",
        description:
          "Profitez de toute la puissance de WordPress avec un site entièrement personnalisé, évolutif et facile à administrer, sans compromis sur les performances.",
        bullets: [
          "Développement WordPress",
          "Thème personnalisé",
          "Extensions professionnelles",
          "Sécurisation du site",
          "Optimisation des performances",
          "Sauvegardes",
          "Formation utilisateur",
          "Documentation",
        ],
        tag: "05",
      },
    ],
  },
  {
    eyebrow: "02 . APPLICATIONS & DÉVELOPPEMENT",
    title: "Des solutions numériques créées exclusivement pour votre entreprise.",
    subtitle:
      "Chaque entreprise possède ses propres méthodes de travail. Nous développons des applications et logiciels sur mesure capables de répondre précisément à vos besoins tout en évoluant avec votre activité.",
    cards: [
      {
        icon: "Globe",
        title: "Application Web",
        description:
          "Développez un outil métier accessible depuis n'importe quel navigateur pour centraliser vos données, automatiser vos processus et améliorer la collaboration.",
        bullets: [
          "Développement personnalisé",
          "Tableau de bord",
          "Gestion des utilisateurs",
          "Authentification sécurisée",
          "Base de données",
          "Interface intuitive",
          "Hébergement Cloud",
          "API personnalisées",
        ],
        tag: "06",
      },
      {
        icon: "Smartphone",
        title: "Application Mobile",
        description:
          "Offrez une expérience mobile moderne à vos utilisateurs grâce à une application disponible sur Android et iPhone.",
        bullets: [
          "Développement Android",
          "Développement iOS",
          "Notifications Push",
          "Synchronisation en temps réel",
          "Authentification",
          "Paiement intégré",
          "Publication sur les stores",
          "Maintenance évolutive",
        ],
        tag: "07",
      },
      {
        icon: "FileText",
        title: "Logiciel Métier",
        description:
          "Digitalisez vos processus grâce à un logiciel entièrement adapté à votre organisation et à vos méthodes de travail.",
        bullets: [
          "Analyse des besoins",
          "Développement personnalisé",
          "Gestion documentaire",
          "Gestion clients",
          "Gestion des équipes",
          "Tableaux de bord",
          "Automatisation",
          "Évolutions futures",
        ],
        tag: "08",
      },
      {
        icon: "Cloud",
        title: "Plateforme SaaS",
        description:
          "Transformez votre idée en plateforme accessible partout dans le monde avec une architecture moderne, sécurisée et évolutive.",
        bullets: [
          "Comptes utilisateurs",
          "Gestion des abonnements",
          "Paiements en ligne",
          "Tableau d'administration",
          "Architecture évolutive",
          "Sécurité avancée",
          "Hébergement Cloud",
          "Monitoring",
        ],
        tag: "09",
      },
      {
        icon: "Zap",
        title: "API & Intégrations",
        description:
          "Connectez tous vos logiciels pour automatiser les échanges de données et supprimer les tâches répétitives.",
        bullets: [
          "API REST",
          "API GraphQL",
          "Connexion CRM",
          "Connexion ERP",
          "Airtable",
          "Notion",
          "Stripe",
          "Synchronisation automatique",
          "Documentation développeur",
        ],
        tag: "10",
      },
    ],
  },
  {
    eyebrow: "03 . IMAGE DE MARQUE",
    title: "Créez une identité forte qui inspire confiance dès le premier regard.",
    subtitle:
      "Votre image de marque est bien plus qu'un simple logo : c'est la première impression que vous laissez à vos clients. Nous concevons un univers graphique cohérent, moderne et mémorable pour renforcer votre crédibilité et vous démarquer durablement.",
    cards: [
      {
        icon: "Palette",
        title: "Identité Visuelle & Logo",
        description:
          "Affirmez votre personnalité grâce à une identité visuelle unique, professionnelle et reconnaissable sur tous vos supports de communication.",
        bullets: [
          "Création d'un logo professionnel et vectoriel",
          "Déclinaisons couleur, noir & blanc et monochrome",
          "Palette de couleurs personnalisée",
          "Sélection des typographies",
          "Charte graphique complète",
          "Icône favicon",
          "Versions adaptées aux réseaux sociaux",
          "Fichiers haute définition (SVG, PNG, PDF, AI)",
        ],
        tag: "11",
      },
      {
        icon: "Monitor",
        title: "Webdesign",
        description:
          "Offrez à vos visiteurs une expérience moderne grâce à un design élégant, intuitif et entièrement pensé pour votre activité.",
        bullets: [
          "Maquettes sur mesure",
          "Design responsive",
          "Parcours utilisateur optimisé",
          "Pages entièrement personnalisées",
          "Animations modernes",
          "Icônes professionnelles",
          "Design cohérent sur toutes les pages",
          "Optimisation de l'expérience utilisateur",
        ],
        tag: "12",
      },
      {
        icon: "Sparkles",
        title: "UI / UX Design",
        description:
          "Transformez une simple interface en véritable expérience utilisateur pour améliorer l'engagement et augmenter vos conversions.",
        bullets: [
          "Analyse des parcours utilisateurs",
          "Wireframes",
          "Prototypes interactifs",
          "Optimisation ergonomique",
          "Design System",
          "Tests utilisateurs",
          "Optimisation des appels à l'action",
          "Amélioration du taux de conversion",
        ],
        tag: "13",
      },
      {
        icon: "Printer",
        title: "Supports de Communication",
        description:
          "Développez une communication homogène sur tous vos supports afin de renforcer votre image professionnelle.",
        bullets: [
          "Cartes de visite",
          "Flyers",
          "Dépliants",
          "Brochures",
          "Affiches",
          "Roll-up",
          "Kakémonos",
          "Cartes de fidélité",
          "Visuels pour impression",
        ],
        tag: "14",
      },
      {
        icon: "Share2",
        title: "Visuels Réseaux Sociaux",
        description:
          "Développez une image professionnelle sur l'ensemble de vos réseaux sociaux grâce à des visuels cohérents et impactants.",
        bullets: [
          "Photo de profil",
          "Bannière Facebook",
          "Bannière LinkedIn",
          "Couverture YouTube",
          "Publications Instagram",
          "Stories",
          "Templates Canva",
          "Miniatures YouTube",
        ],
        tag: "15",
      },
      {
        icon: "Palette",
        title: "Création de Logo",
        description:
          "Créez un logo professionnel et mémorable qui représente votre entreprise et renforce votre image de marque dès le premier regard.",
        bullets: [
          "Recherche créative et direction artistique",
          "Logo moderne et vectoriel",
          "Déclinaisons couleurs et monochrome",
          "Formats professionnels (SVG, PNG, PDF)",
          "Adaptation web et impression",
        ],
        tag: "16",
      },
      {
        icon: "Palette",
        title: "Charte Graphique",
        description:
          "Définissez une identité visuelle cohérente pour communiquer avec une image professionnelle sur tous vos supports.",
        bullets: [
          "Palette de couleurs personnalisée",
          "Choix des typographies",
          "Règles d'utilisation du logo",
          "Univers graphique complet",
          "Guide de marque professionnel",
        ],
        tag: "17",
      },
    ],
  },
  {
    eyebrow: "04 . VISIBILITÉ & ACQUISITION",
    title: "Faites connaître votre entreprise et attirez des clients qualifiés.",
    subtitle:
      "Créer un site est une première étape. Le rendre visible est essentiel. Nous mettons en place une stratégie d'acquisition performante afin d'améliorer votre référencement, développer votre notoriété et générer de nouveaux clients.",
    cards: [
      {
        icon: "Search",
        title: "Référencement Naturel (SEO)",
        description:
          "Positionnez durablement votre site sur Google afin d'obtenir un trafic qualifié sans dépendre uniquement de la publicité.",
        bullets: [
          "Audit SEO complet",
          "Recherche de mots-clés",
          "Optimisation technique",
          "Optimisation des performances",
          "Optimisation des balises",
          "Structure des contenus",
          "Maillage interne",
          "SEO local",
          "Suivi du positionnement",
        ],
        tag: "18",
      },
      {
        icon: "Globe",
        title: "Google Business Profile",
        description:
          "Développez votre visibilité locale et apparaissez dans les premiers résultats de recherche près de vos clients.",
        bullets: [
          "Création de la fiche",
          "Optimisation complète",
          "Ajout des services",
          "Optimisation des catégories",
          "Gestion des photos",
          "Publication d'actualités",
          "Gestion des avis",
          "Conseils pour améliorer votre visibilité",
        ],
        tag: "19",
      },
      {
        icon: "Megaphone",
        title: "Google Ads",
        description:
          "Attirez rapidement des prospects grâce à des campagnes publicitaires rentables et optimisées.",
        bullets: [
          "Création des campagnes",
          "Recherche de mots-clés",
          "Paramétrage des audiences",
          "Extensions d'annonces",
          "Optimisation du budget",
          "Suivi des conversions",
          "Rapports mensuels",
          "Optimisations continues",
        ],
        tag: "20",
      },
      {
        icon: "Share2",
        title: "Publicité sur les Réseaux Sociaux",
        description:
          "Touchez les bonnes personnes au bon moment grâce à des campagnes publicitaires ciblées.",
        bullets: [
          "Facebook Ads",
          "Instagram Ads",
          "LinkedIn Ads",
          "TikTok Ads",
          "Création des audiences",
          "Création des visuels",
          "Optimisation des campagnes",
          "Analyse des performances",
        ],
        tag: "21",
      },
      {
        icon: "MessageSquare",
        title: "Community Management",
        description:
          "Développez votre communauté et fidélisez vos clients grâce à une présence régulière sur les réseaux sociaux.",
        bullets: [
          "Calendrier éditorial",
          "Création des publications",
          "Création des stories",
          "Réponse aux commentaires",
          "Animation de communauté",
          "Veille concurrentielle",
          "Analyse des statistiques",
          "Optimisation continue",
        ],
        tag: "22",
      },
      {
        icon: "PenTool",
        title: "Création de Contenu",
        description:
          "Produisez des contenus utiles et engageants qui renforcent votre image d'expert et améliorent votre référencement.",
        bullets: [
          "Articles de blog",
          "Pages SEO",
          "Textes commerciaux",
          "Publications réseaux sociaux",
          "Newsletters",
          "Guides",
          "Livres blancs",
          "Optimisation SEO",
        ],
        tag: "23",
      },
      {
        icon: "Mail",
        title: "Email Marketing",
        description:
          "Fidélisez vos clients grâce à des campagnes emailing professionnelles et automatisées.",
        bullets: [
          "Création de newsletters",
          "Design responsive",
          "Segmentation des contacts",
          "Automatisation des scénarios",
          "Analyse des performances",
          "Optimisation du taux d'ouverture",
          "Optimisation du taux de clic",
          "Reporting",
        ],
        tag: "24",
      },
      {
        icon: "BarChart3",
        title: "Analyse & Reporting",
        description:
          "Prenez les bonnes décisions grâce à des tableaux de bord clairs et des indicateurs précis.",
        bullets: [
          "Google Analytics",
          "Google Search Console",
          "Tableaux de bord",
          "Analyse du trafic",
          "Analyse des conversions",
          "Rapports mensuels",
          "Recommandations stratégiques",
          "Suivi des objectifs",
        ],
        tag: "25",
      },
      {
        icon: "Search",
        title: "Audit SEO",
        description:
          "Analysez les performances de votre site et découvrez les opportunités pour améliorer votre visibilité sur Google.",
        bullets: [
          "Analyse technique complète",
          "Analyse des mots-clés",
          "Étude de la concurrence",
          "Identification des problèmes SEO",
          "Plan d'action priorisé",
        ],
        tag: "26",
      },
      {
        icon: "MapPin",
        title: "SEO Local",
        description:
          "Développez votre visibilité auprès des clients proches de votre entreprise et attirez plus de prospects dans votre zone géographique.",
        bullets: [
          "Optimisation Google Business Profile",
          "Optimisation des recherches locales",
          "Création de contenus locaux",
          "Gestion de la visibilité locale",
          "Stratégie d'avis clients",
        ],
        tag: "27",
      },
    ],
  },
  {
    eyebrow: "05 . IA & AUTOMATISATION",
    title:
      "Gagnez du temps, automatisez vos tâches et exploitez tout le potentiel de l'intelligence artificielle.",
    subtitle:
      "L'intelligence artificielle transforme la façon de travailler des entreprises. Chez WebXIA, nous concevons des solutions intelligentes qui automatisent les tâches répétitives, optimisent vos processus et vous permettent de vous concentrer sur l'essentiel : le développement de votre activité.",
    cards: [
      {
        icon: "Bot",
        title: "Chatbot IA",
        description:
          "Offrez une assistance disponible 24h/24 et 7j/7 pour répondre instantanément à vos visiteurs, qualifier vos prospects et améliorer votre relation client.",
        bullets: [
          "Chatbot personnalisé à votre activité",
          "Réponses intelligentes basées sur l'IA",
          "Qualification automatique des prospects",
          "Prise de rendez-vous",
          "Formulaires interactifs",
          "FAQ intelligente",
          "Connexion à votre site web",
          "Statistiques et suivi des conversations",
        ],
        tag: "28",
      },
      {
        icon: "Zap",
        title: "Automatisation des Processus",
        description:
          "Automatisez les tâches répétitives afin de gagner du temps, réduire les erreurs et améliorer votre productivité.",
        bullets: [
          "Automatisation des tâches administratives",
          "Synchronisation entre vos logiciels",
          "Notifications automatiques",
          "Gestion documentaire",
          "Traitement des formulaires",
          "Génération automatique de devis",
          "Envoi d'emails automatiques",
          "Optimisation des workflows",
        ],
        tag: "29",
      },
      {
        icon: "Users",
        title: "Agents IA",
        description:
          "Déployez des assistants intelligents capables d'exécuter des missions complexes en toute autonomie.",
        bullets: [
          "Recherche d'informations",
          "Génération de contenus",
          "Assistance commerciale",
          "Support client",
          "Analyse documentaire",
          "Rédaction automatique",
          "Résumé de documents",
          "Assistance métier personnalisée",
        ],
        tag: "30",
      },
      {
        icon: "Share2",
        title: "Intégration de vos Outils",
        description:
          "Reliez tous vos logiciels afin de créer un véritable écosystème numérique performant.",
        bullets: [
          "Connexion CRM",
          "Connexion ERP",
          "Airtable",
          "Notion",
          "Google Workspace",
          "Microsoft 365",
          "Stripe",
          "API personnalisées",
          "Synchronisation en temps réel",
        ],
        tag: "31",
      },
      {
        icon: "BarChart3",
        title: "Tableaux de Bord Intelligents",
        description:
          "Pilotez votre activité grâce à des tableaux de bord interactifs alimentés automatiquement par vos données.",
        bullets: [
          "Indicateurs personnalisés",
          "Statistiques en temps réel",
          "Rapports automatiques",
          "Visualisation des performances",
          "Export PDF",
          "Alertes intelligentes",
          "Connexion multi-outils",
          "Analyse des données",
        ],
        tag: "32",
      },
      {
        icon: "Zap",
        title: "Automatisation n8n",
        description:
          "Connectez vos outils et automatisez vos processus métier grâce à des workflows intelligents et personnalisés.",
        bullets: [
          "Création de workflows automatisés",
          "Connexion API",
          "Automatisation CRM",
          "Synchronisation des données",
          "Notifications automatiques",
        ],
        tag: "33",
      },
      {
        icon: "Zap",
        title: "Automatisation Make",
        description:
          "Simplifiez votre quotidien en connectant vos applications et en supprimant les tâches répétitives.",
        bullets: [
          "Scénarios Make personnalisés",
          "Connexion Google Workspace",
          "Airtable, Notion, CRM",
          "Automatisation emailing",
          "Synchronisation automatique",
        ],
        tag: "34",
      },
      {
        icon: "FileText",
        title: "IA Documentaire",
        description:
          "Transformez vos documents en informations exploitables grâce à l'intelligence artificielle.",
        bullets: [
          "Analyse automatique de documents",
          "Extraction d'informations",
          "Recherche intelligente",
          "Résumés automatiques",
          "Classement documentaire",
        ],
        tag: "35",
      },
      {
        icon: "MessageSquare",
        title: "IA Conversationnelle",
        description:
          "Améliorez votre relation client grâce à des assistants capables de comprendre et répondre naturellement.",
        bullets: [
          "Chatbots intelligents",
          "Assistants clients 24/7",
          "FAQ automatisée",
          "Qualification des prospects",
          "Intégration site web",
        ],
        tag: "36",
      },
      {
        icon: "MessageCircle",
        title: "Bots Telegram & WhatsApp Business",
        description:
          "Automatisez vos échanges clients grâce à des assistants connectés aux plateformes de messagerie.",
        bullets: [
          "Bots Telegram personnalisés",
          "WhatsApp Business API",
          "Réponses automatiques",
          "Notifications clients",
          "Prise de commandes ou rendez-vous",
        ],
        tag: "37",
      },
    ],
  },
  {
    eyebrow: "06 . CONSEIL & CROISSANCE",
    title:
      "Construisez une stratégie digitale solide pour développer durablement votre entreprise.",
    subtitle:
      "Chaque projet commence par une vision claire. Nous vous accompagnons dans vos choix technologiques, marketing et stratégiques afin de construire une présence digitale performante et pérenne.",
    cards: [
      {
        icon: "Search",
        title: "Audit Digital",
        description:
          "Analysez votre présence en ligne afin d'identifier les opportunités d'amélioration et de croissance.",
        bullets: [
          "Audit du site internet",
          "Analyse UX/UI",
          "Audit SEO",
          "Analyse des performances",
          "Audit sécurité",
          "Étude concurrentielle",
          "Recommandations prioritaires",
          "Plan d'amélioration",
        ],
        tag: "38",
      },
      {
        icon: "TrendingUp",
        title: "Stratégie Digitale",
        description:
          "Définissez une feuille de route claire pour développer efficacement votre activité sur Internet.",
        bullets: [
          "Analyse des objectifs",
          "Définition des cibles",
          "Positionnement",
          "Plan d'acquisition",
          "Tunnel de conversion",
          "Choix des outils",
          "Roadmap digitale",
          "Accompagnement stratégique",
        ],
        tag: "39",
      },
      {
        icon: "Zap",
        title: "Transformation Numérique",
        description:
          "Modernisez votre entreprise grâce aux outils numériques adaptés à votre organisation.",
        bullets: [
          "Analyse des processus",
          "Digitalisation des tâches",
          "Sélection des logiciels",
          "Automatisation",
          "Formation des équipes",
          "Déploiement",
          "Accompagnement au changement",
          "Optimisation continue",
        ],
        tag: "40",
      },
      {
        icon: "FileText",
        title: "Gestion de Projet",
        description:
          "Confiez-nous le pilotage de votre projet pour garantir un déploiement fluide, organisé et maîtrisé.",
        bullets: [
          "Cahier des charges",
          "Planification",
          "Coordination des intervenants",
          "Suivi des délais",
          "Contrôle qualité",
          "Réunions de suivi",
          "Reporting",
          "Livraison du projet",
        ],
        tag: "41",
      },
      {
        icon: "BookOpen",
        title: "Formation & Accompagnement",
        description: "Prenez en main vos outils rapidement grâce à un accompagnement personnalisé.",
        bullets: [
          "Formation WordPress",
          "Formation e-commerce",
          "Formation IA",
          "Formation SEO",
          "Documentation",
          "Tutoriels vidéo",
          "Assistance après livraison",
          "Conseils personnalisés",
        ],
        tag: "42",
      },
    ],
  },
  {
    eyebrow: "07 . MAINTENANCE & HÉBERGEMENT",
    title: "Assurez la sécurité, la stabilité et l'évolution de votre site sur le long terme.",
    subtitle:
      "Un site performant nécessite un suivi régulier. Nous assurons la maintenance, les mises à jour et l'assistance afin que votre site reste rapide, sécurisé et toujours disponible.",
    cards: [
      {
        icon: "Wrench",
        title: "Maintenance",
        description: "Gardez votre site toujours à jour et parfaitement fonctionnel.",
        bullets: [
          "Mises à jour",
          "Correctifs",
          "Surveillance",
          "Optimisation des performances",
          "Vérification du bon fonctionnement",
          "Maintenance préventive",
          "Support technique",
          "Assistance prioritaire",
        ],
        tag: "43",
      },
      {
        icon: "Shield",
        title: "Sécurité",
        description:
          "Protégez vos données, celles de vos clients et votre activité contre les menaces informatiques.",
        bullets: [
          "Certificat SSL",
          "Sauvegardes automatiques",
          "Pare-feu",
          "Protection anti-malware",
          "Surveillance permanente",
          "Détection des failles",
          "Restauration rapide",
          "Sécurisation des accès",
        ],
        tag: "44",
      },
      {
        icon: "Cloud",
        title: "Hébergement Web",
        description: "Profitez d'un hébergement fiable, rapide et sécurisé adapté à vos besoins.",
        bullets: [
          "Hébergement haute performance",
          "Sauvegardes quotidiennes",
          "Haute disponibilité",
          "Nom de domaine",
          "Certificat SSL",
          "Emails professionnels",
          "Monitoring",
          "Migration offerte",
        ],
        tag: "45",
      },
      {
        icon: "Phone",
        title: "Assistance Technique",
        description: "Bénéficiez d'un support réactif pour résoudre rapidement tous vos problèmes.",
        bullets: [
          "Assistance par email",
          "Assistance téléphonique",
          "Intervention rapide",
          "Prise en main à distance",
          "Diagnostic",
          "Conseils techniques",
          "Suivi personnalisé",
          "Support prioritaire",
        ],
        tag: "46",
      },
      {
        icon: "TrendingUp",
        title: "Évolutions & Optimisations",
        description:
          "Votre entreprise évolue, votre site aussi. Nous faisons évoluer vos outils au rythme de vos besoins.",
        bullets: [
          "Nouvelles fonctionnalités",
          "Optimisation des performances",
          "Ajout de modules",
          "Amélioration UX",
          "Optimisation SEO",
          "Nouvelles intégrations",
          "Évolutions graphiques",
          "Accompagnement continu",
        ],
        tag: "47",
      },
    ],
  },
];
