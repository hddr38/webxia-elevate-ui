/**
 * Contenus légaux (FR) — extrait des routes cgu, mentions-legales et
 * politique-confidentialite (LOT "I18N PHASE 1", scénario C hybride).
 *
 * Ces pages étaient rédigées en dur dans les JSX ; le contenu est ici
 * déclaratif et le rendu est assuré par chaque route selon
 * `useLocale().locale`. `legal-en.ts` importe les types ci-dessous.
 */

export type LegalInline =
  string | { text: string; strong?: true } | { href: string; label: string; external?: true };

export type LegalBlock =
  | { kind: "p"; content: LegalInline[]; gap?: "sm" | "md" }
  | { kind: "ul"; style: "disc" | "plain"; items: LegalInline[][] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalContent = {
  backLink: string;
  title: string;
  intro: LegalInline[];
  sections: LegalSection[];
};

const BACK_LINK = "Retour à l'accueil";

export const cguContent: LegalContent = {
  backLink: BACK_LINK,
  title: "Conditions Générales d'Utilisation (CGU)",
  intro: [
    "Les présentes Conditions Générales d'Utilisation (ci-après \"CGU\") régissent l'accès et l'utilisation du site webxia.fr. En accédant au site, l'utilisateur accepte sans réserve les présentes CGU.",
  ],
  sections: [
    {
      heading: "Article 1 : Accès au site",
      blocks: [
        {
          kind: "p",
          content: [
            "Le site webxia.fr est accessible gratuitement à tout utilisateur disposant d'un accès à Internet. Les frais d'accès et d'utilisation du matériel (ordinateur, connexion Internet) sont à la charge de l'utilisateur.",
          ],
        },
        {
          kind: "p",
          gap: "sm",
          content: [
            "WebXIA s'efforce de permettre l'accès au site 24h/24, 7j/7, mais ne saurait être tenu responsable des interruptions liées à des opérations de maintenance, de mise à jour, ou de problèmes techniques indépendants de sa volonté.",
          ],
        },
      ],
    },
    {
      heading: "Article 2 : Utilisation du site",
      blocks: [
        {
          kind: "p",
          content: [
            "L'utilisateur s'engage à utiliser le site de manière conforme aux lois en vigueur et à ne pas porter atteinte aux droits de WebXIA ou de tiers. Sont notamment interdits :",
          ],
        },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["L'accès frauduleux ou la tentative d'accès à des zones non publiques du site."],
            ["L'introduction de virus, chevaux de Troie ou tout autre code malveillant."],
            ["L'extraction automatisée de données (scraping) sans autorisation préalable."],
            ["L'utilisation du site à des fins de prospection commerciale sans accord de WebXIA."],
          ],
        },
      ],
    },
    {
      heading: "Article 3 : Propriété intellectuelle",
      blocks: [
        {
          kind: "p",
          content: [
            "Tous les éléments présents sur le site (textes, logos, graphismes, code source) sont la propriété exclusive de WebXIA ou de ses partenaires. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite et constitue une contrefaçon.",
          ],
        },
      ],
    },
    {
      heading: "Article 4 : Prestations et Paiements",
      blocks: [
        {
          kind: "p",
          content: [
            "Le site webxia.fr a pour objet la présentation des services de WebXIA. Les informations fournies sont à titre indicatif.",
          ],
        },
        {
          kind: "p",
          gap: "sm",
          content: ["Le paiement des prestations peut s'effectuer de deux manières :"],
        },
        {
          kind: "ul",
          style: "disc",
          items: [
            [
              { text: "En ligne :", strong: true },
              " Via un système de paiement sécurisé. Les transactions sont traitées par un prestataire de paiement tiers. WebXIA n'a à aucun moment accès aux coordonnées bancaires de l'utilisateur.",
            ],
            [
              { text: "Par facture classique :", strong: true },
              " Par virement bancaire selon les modalités définies sur le devis ou la facture émise par WebXIA.",
            ],
          ],
        },
        {
          kind: "p",
          gap: "sm",
          content: [
            "Les conditions financières et techniques de chaque prestation sont définies dans un contrat ou un devis spécifique accepté par les deux parties.",
          ],
        },
      ],
    },
    {
      heading: "Article 5 : Liens hypertextes",
      blocks: [
        {
          kind: "p",
          content: [
            "Le site peut contenir des liens vers des sites tiers. WebXIA n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu ou leurs pratiques en matière de protection des données.",
          ],
        },
      ],
    },
    {
      heading: "Article 6 : Responsabilité",
      blocks: [
        {
          kind: "p",
          content: [
            "WebXIA ne saurait être tenu responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation du site, notamment des pertes de données, de virus, ou de pannes matérielles. Le site est fourni \"tel quel\" sans garantie d'aucune sorte.",
          ],
        },
      ],
    },
    {
      heading: "Article 7 : Modification des CGU",
      blocks: [
        {
          kind: "p",
          content: [
            "WebXIA se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs sont invités à les consulter régulièrement. La version applicable est celle en ligne à la date d'utilisation du site.",
          ],
        },
      ],
    },
    {
      heading: "Article 8 : Droit applicable et juridiction compétente",
      blocks: [
        {
          kind: "p",
          content: [
            "Les présentes CGU sont régies par le droit français. En cas de litige, et après recherche d'une solution amiable, les tribunaux français seront seuls compétents.",
          ],
        },
      ],
    },
  ],
};

export const mentionsContent: LegalContent = {
  backLink: BACK_LINK,
  title: "Mentions Légales",
  intro: [
    "Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), il est précisé aux utilisateurs du site webxia.fr l'identité des différents intervenants dans le cadre de sa réalisation et de son suivi.",
  ],
  sections: [
    {
      heading: "Éditeur du site",
      blocks: [
        { kind: "p", content: ["Le site webxia.fr est édité par :"] },
        {
          kind: "ul",
          style: "plain",
          items: [
            [{ text: "WebXIA", strong: true }, " — Micro-entreprise"],
            ["Représentée par : Mehdi E."],
            ["Adresse : 30 allée Robert Boulin, 33500 Libourne, France"],
            ["Email : ", { href: "mailto:webxia@protonmail.com", label: "webxia@protonmail.com" }],
            ["Numéro SIRET : 87179907200018"],
            ["Code APE / NAF : 6201Z — Programmation informatique"],
          ],
        },
      ],
    },
    {
      heading: "Hébergeur du site",
      blocks: [
        { kind: "p", content: ["Le site webxia.fr est hébergé par :"] },
        {
          kind: "ul",
          style: "plain",
          items: [
            [{ text: "Netlify, Inc.", strong: true }],
            ["Adresse : 2325 3rd Street, Suite 296, San Francisco, California 94107, USA"],
            [
              "Site web : ",
              { href: "https://www.netlify.com", label: "www.netlify.com", external: true },
            ],
          ],
        },
      ],
    },
    {
      heading: "Propriété intellectuelle",
      blocks: [
        {
          kind: "p",
          content: [
            "L'ensemble du contenu du site webxia.fr (incluant de manière non limitative les textes, graphismes, images, photos, sons, vidéos, logos, icônes, et code source) est la propriété exclusive de WebXIA, sauf mention contraire. Toute reproduction, représentation, modification, publication, adaptation totale ou partielle de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de WebXIA. Toute exploitation non autorisée du site ou de l'un quelconque des éléments qu'il contient sera considérée comme constitutive d'une contrefaçon et poursuivie conformément aux dispositions des articles L.335-2 et suivants du Code de la Propriété Intellectuelle.",
          ],
        },
      ],
    },
    {
      heading: "Liens hypertextes",
      blocks: [
        {
          kind: "p",
          content: [
            "Le site webxia.fr peut contenir des liens hypertextes vers d'autres sites. WebXIA n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.",
          ],
        },
      ],
    },
  ],
};

export const confidentialiteContent: LegalContent = {
  backLink: BACK_LINK,
  title: "Politique de Confidentialité",
  intro: [
    "WebXIA s'engage à protéger la vie privée des utilisateurs de son site webxia.fr. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.",
  ],
  sections: [
    {
      heading: "1. Responsable du traitement",
      blocks: [
        {
          kind: "p",
          content: [
            "Le responsable du traitement des données est WebXIA, représentée par Mehdi E., ayant son adresse à 30 allée Robert Boulin, 33500 Libourne, France, joignable à l'adresse suivante : ",
            { href: "mailto:webxia@protonmail.com", label: "webxia@protonmail.com" },
            ".",
          ],
        },
      ],
    },
    {
      heading: "2. Données collectées",
      blocks: [
        { kind: "p", content: ["Nous collectons les données suivantes :"] },
        {
          kind: "ul",
          style: "disc",
          items: [
            [
              { text: "Données de contact :", strong: true },
              " Nom, prénom, adresse e-mail et contenu de votre message lorsque vous remplissez notre formulaire de contact.",
            ],
            [
              { text: "Données de paiement :", strong: true },
              " En cas de paiement en ligne, les transactions sont sécurisées par notre prestataire de paiement. WebXIA ne stocke aucune donnée bancaire (les coordonnées de carte bleue ne transitent jamais par nos serveurs).",
            ],
            [
              { text: "Données techniques :", strong: true },
              " Adresse IP, type de navigateur (données strictement nécessaires au fonctionnement du site).",
            ],
          ],
        },
      ],
    },
    {
      heading: "3. Finalités du traitement",
      blocks: [
        { kind: "p", content: ["Les données collectées sont utilisées pour :"] },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Répondre à vos demandes d'information, de devis ou de contact."],
            ["Traiter vos paiements en ligne et vous fournir les prestations commandées."],
            ["Respecter nos obligations légales et comptables."],
          ],
        },
      ],
    },
    {
      heading: "4. Base légale",
      blocks: [
        { kind: "p", content: ["Le traitement de vos données est fondé sur :"] },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Votre consentement (lorsque vous remplissez le formulaire de contact)."],
            [
              "L'exécution de mesures précontractuelles ou d'un contrat (pour les paiements et prestations).",
            ],
            ["Notre intérêt légitime à répondre à vos demandes et à assurer la sécurité du site."],
          ],
        },
      ],
    },
    {
      heading: "5. Durée de conservation",
      blocks: [
        {
          kind: "p",
          content: [
            "Vos données personnelles sont conservées pour une durée maximale de 3 ans après votre dernière interaction avec nos services, sauf si une durée de conservation plus longue est requise par la loi (notamment pour la preuve d'un droit ou d'un contrat, ou les obligations comptables qui exigent une conservation de 10 ans).",
          ],
        },
      ],
    },
    {
      heading: "6. Partage des données",
      blocks: [
        {
          kind: "p",
          content: [
            "Vos données ne sont jamais vendues à des tiers. Elles peuvent uniquement être partagées avec nos prestataires techniques (hébergeur du site, prestataire de paiement en ligne) agissant en tant que sous-traitants, ou si la loi l'exige.",
          ],
        },
      ],
    },
    {
      heading: "7. Cookies et traceurs",
      blocks: [
        {
          kind: "p",
          content: [
            "Le site webxia.fr n'utilise pas de cookies de tracking publicitaire ni d'outils d'analyse de trafic tiers (comme Google Analytics ou Meta Pixel). Seuls des cookies strictement nécessaires au bon fonctionnement technique du site peuvent être utilisés, ne nécessitant pas de consentement préalable.",
          ],
        },
      ],
    },
    {
      heading: "8. Vos droits (RGPD)",
      blocks: [
        {
          kind: "p",
          content: [
            "Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :",
          ],
        },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Droit d'accès, de rectification et d'effacement."],
            ["Droit à la limitation et à l'opposition du traitement."],
            ["Droit à la portabilité de vos données."],
            ["Droit de retirer votre consentement à tout moment."],
          ],
        },
        {
          kind: "p",
          gap: "md",
          content: [
            "Pour exercer ces droits, vous pouvez nous contacter à : ",
            { href: "mailto:webxia@protonmail.com", label: "webxia@protonmail.com" },
            ". Vous avez également le droit d'introduire une réclamation auprès de la ",
            { href: "https://www.cnil.fr", label: "CNIL (www.cnil.fr)", external: true },
            ".",
          ],
        },
      ],
    },
  ],
};
