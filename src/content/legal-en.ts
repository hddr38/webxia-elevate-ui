/**
 * Legal contents (EN) — English translation of the French pages exported
 * from legal-fr.ts (LOT "I18N PHASE 1"). Standard legal register.
 * Each route renders `locale === "en" ? EN : FR`.
 */
import type { LegalContent } from "./legal-fr";

const BACK_LINK = "Back to home";

export const cguContentEn: LegalContent = {
  backLink: BACK_LINK,
  title: "Terms and Conditions of Use (ToS)",
  intro: [
    'These Terms and Conditions of Use (hereinafter "ToS") govern access to and use of the website webxia.fr. By accessing the site, the user fully accepts these ToS.',
  ],
  sections: [
    {
      heading: "Article 1: Access to the Site",
      blocks: [
        {
          kind: "p",
          content: [
            "The website webxia.fr is freely accessible to any user with an Internet connection. Costs associated with accessing and operating the equipment (computer, Internet connection) are borne by the user.",
          ],
        },
        {
          kind: "p",
          gap: "sm",
          content: [
            "WebXIA strives to keep the site accessible 24/7, but cannot be held liable for interruptions related to maintenance operations, updates, or technical issues beyond its control.",
          ],
        },
      ],
    },
    {
      heading: "Article 2: Use of the Site",
      blocks: [
        {
          kind: "p",
          content: [
            "The user agrees to use the site in compliance with applicable laws and not to infringe upon the rights of WebXIA or third parties. The following are expressly prohibited:",
          ],
        },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Fraudulent access or attempted access to non-public areas of the site."],
            ["Introduction of viruses, Trojan horses or any other malicious code."],
            ["Automated data extraction (scraping) without prior authorisation."],
            ["Use of the site for commercial prospecting purposes without WebXIA's consent."],
          ],
        },
      ],
    },
    {
      heading: "Article 3: Intellectual Property",
      blocks: [
        {
          kind: "p",
          content: [
            "All elements present on the site (texts, logos, graphics, source code) are the exclusive property of WebXIA or its partners. Any reproduction, even partial, without prior written authorisation is prohibited and constitutes an infringement.",
          ],
        },
      ],
    },
    {
      heading: "Article 4: Services and Payments",
      blocks: [
        {
          kind: "p",
          content: [
            "The website webxia.fr is intended to present WebXIA's services. The information provided is for indicative purposes only.",
          ],
        },
        {
          kind: "p",
          gap: "sm",
          content: ["Payment for services may be made in two ways:"],
        },
        {
          kind: "ul",
          style: "disc",
          items: [
            [
              { text: "Online:", strong: true },
              " Through a secure payment system. Transactions are processed by a third-party payment provider. WebXIA never has access to the user's bank details.",
            ],
            [
              { text: "By standard invoice:", strong: true },
              " By bank transfer under the terms set out in the quote or invoice issued by WebXIA.",
            ],
          ],
        },
        {
          kind: "p",
          gap: "sm",
          content: [
            "The financial and technical terms of each service are defined in a specific contract or quote accepted by both parties.",
          ],
        },
      ],
    },
    {
      heading: "Article 5: Hyperlinks",
      blocks: [
        {
          kind: "p",
          content: [
            "The site may contain links to third-party sites. WebXIA exercises no control over these sites and disclaims any liability regarding their content or their data protection practices.",
          ],
        },
      ],
    },
    {
      heading: "Article 6: Liability",
      blocks: [
        {
          kind: "p",
          content: [
            'WebXIA cannot be held liable for any direct or indirect damage resulting from access to or use of the site, including data loss, viruses, or hardware failures. The site is provided "as is" without any warranty.',
          ],
        },
      ],
    },
    {
      heading: "Article 7: Amendment of the ToS",
      blocks: [
        {
          kind: "p",
          content: [
            "WebXIA reserves the right to amend these ToS at any time. Users are invited to consult them regularly. The applicable version is the one published online at the time of use of the site.",
          ],
        },
      ],
    },
    {
      heading: "Article 8: Governing Law and Jurisdiction",
      blocks: [
        {
          kind: "p",
          content: [
            "These ToS are governed by French law. In the event of a dispute, and after attempting an amicable settlement, the French courts shall have exclusive jurisdiction.",
          ],
        },
      ],
    },
  ],
};

export const mentionsContentEn: LegalContent = {
  backLink: BACK_LINK,
  title: "Legal Notice",
  intro: [
    "Pursuant to French Act No. 2004-575 of 21 June 2004 on confidence in the digital economy (LCEN), the following information sets out the identity of the parties involved in the creation and maintenance of the website webxia.fr.",
  ],
  sections: [
    {
      heading: "Site Publisher",
      blocks: [
        { kind: "p", content: ["The website webxia.fr is published by:"] },
        {
          kind: "ul",
          style: "plain",
          items: [
            [{ text: "WebXIA", strong: true }, " — Sole proprietorship (micro-entreprise)"],
            ["Represented by: Mehdi E."],
            ["Address: 30 allée Robert Boulin, 33500 Libourne, France"],
            ["Email: ", { href: "mailto:webxia@protonmail.com", label: "webxia@protonmail.com" }],
            ["SIRET number: 87179907200018"],
            ["APE / NAF code: 6201Z — Computer programming"],
          ],
        },
      ],
    },
    {
      heading: "Hosting Provider",
      blocks: [
        { kind: "p", content: ["The website webxia.fr is hosted by:"] },
        {
          kind: "ul",
          style: "plain",
          items: [
            [{ text: "Netlify, Inc.", strong: true }],
            ["Address: 2325 3rd Street, Suite 296, San Francisco, California 94107, USA"],
            [
              "Website: ",
              { href: "https://www.netlify.com", label: "www.netlify.com", external: true },
            ],
          ],
        },
      ],
    },
    {
      heading: "Intellectual Property",
      blocks: [
        {
          kind: "p",
          content: [
            "All content of the website webxia.fr (including, without limitation, texts, graphics, images, photographs, sounds, videos, logos, icons and source code) is the exclusive property of WebXIA unless otherwise stated. Any reproduction, representation, modification, publication, adaptation, total or partial, of any element of the site, by any means or process whatsoever, is prohibited without WebXIA's prior written authorisation. Any unauthorised use of the site or of any of its constituent elements shall be considered an infringement and prosecuted in accordance with Articles L.335-2 and following of the French Intellectual Property Code.",
          ],
        },
      ],
    },
    {
      heading: "Hyperlinks",
      blocks: [
        {
          kind: "p",
          content: [
            "The website webxia.fr may contain hyperlinks to other sites. WebXIA exercises no control over these sites and disclaims any liability regarding their content.",
          ],
        },
      ],
    },
  ],
};

export const confidentialiteContentEn: LegalContent = {
  backLink: BACK_LINK,
  title: "Privacy Policy",
  intro: [
    "WebXIA is committed to protecting the privacy of users of its website webxia.fr. This privacy policy explains how we collect, use and protect your personal data in accordance with the General Data Protection Regulation (GDPR) and the French Data Protection Act (loi Informatique et Libertés).",
  ],
  sections: [
    {
      heading: "1. Data Controller",
      blocks: [
        {
          kind: "p",
          content: [
            "The data controller is WebXIA, represented by Mehdi E., located at 30 allée Robert Boulin, 33500 Libourne, France, reachable at the following address: ",
            { href: "mailto:webxia@protonmail.com", label: "webxia@protonmail.com" },
            ".",
          ],
        },
      ],
    },
    {
      heading: "2. Data Collected",
      blocks: [
        { kind: "p", content: ["We collect the following data:"] },
        {
          kind: "ul",
          style: "disc",
          items: [
            [
              { text: "Contact data:", strong: true },
              " First name, last name, email address and the content of your message when you fill in our contact form.",
            ],
            [
              { text: "Payment data:", strong: true },
              " For online payments, transactions are secured by our payment provider. WebXIA does not store any banking data (card details never pass through our servers).",
            ],
            [
              { text: "Technical data:", strong: true },
              " IP address, browser type (strictly necessary data for the operation of the site).",
            ],
          ],
        },
      ],
    },
    {
      heading: "3. Purpose of Processing",
      blocks: [
        { kind: "p", content: ["Collected data is used to:"] },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Answer your requests for information, quotes or contact."],
            ["Process your online payments and deliver the services you have ordered."],
            ["Comply with our legal and accounting obligations."],
          ],
        },
      ],
    },
    {
      heading: "4. Legal Basis",
      blocks: [
        { kind: "p", content: ["The processing of your data is based on:"] },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Your consent (when you fill in the contact form)."],
            [
              "The performance of pre-contractual measures or of a contract (for payments and services).",
            ],
            [
              "Our legitimate interest in answering your requests and ensuring the security of the site.",
            ],
          ],
        },
      ],
    },
    {
      heading: "5. Retention Period",
      blocks: [
        {
          kind: "p",
          content: [
            "Your personal data is retained for a maximum period of 3 years after your last interaction with our services, unless a longer retention period is required by law (in particular for the proof of a right or a contract, or accounting obligations requiring a 10-year retention period).",
          ],
        },
      ],
    },
    {
      heading: "6. Data Sharing",
      blocks: [
        {
          kind: "p",
          content: [
            "Your data is never sold to third parties. It may only be shared with our technical service providers (site host, online payment provider) acting as processors, or where required by law.",
          ],
        },
      ],
    },
    {
      heading: "7. Cookies and Trackers",
      blocks: [
        {
          kind: "p",
          content: [
            "The website webxia.fr does not use advertising tracking cookies or third-party traffic analytics tools (such as Google Analytics or Meta Pixel). Only cookies strictly necessary for the technical operation of the site may be used, which do not require prior consent.",
          ],
        },
      ],
    },
    {
      heading: "8. Your Rights (GDPR)",
      blocks: [
        {
          kind: "p",
          content: ["Under the GDPR, you have the following rights regarding your personal data:"],
        },
        {
          kind: "ul",
          style: "disc",
          items: [
            ["Right of access, rectification and erasure."],
            ["Right to restriction of and objection to processing."],
            ["Right to data portability."],
            ["Right to withdraw your consent at any time."],
          ],
        },
        {
          kind: "p",
          gap: "md",
          content: [
            "To exercise these rights, you may contact us at: ",
            { href: "mailto:webxia@protonmail.com", label: "webxia@protonmail.com" },
            ". You also have the right to lodge a complaint with the ",
            { href: "https://www.cnil.fr", label: "CNIL (www.cnil.fr)", external: true },
            ".",
          ],
        },
      ],
    },
  ],
};
