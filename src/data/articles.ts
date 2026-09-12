export type ArticleCategory = "article" | "case-study" | "news";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: ArticleCategory;
  date: string; // ISO
  readingMinutes: number;
  author: string;
  cover: string;
  /** Plain paragraphs rendered as <p> */
  content: string[];
};

export const articles: Article[] = [
  {
    slug: "shipping-edge-react-in-2026",
    title: "Shipping React at the edge in 2026",
    excerpt:
      "Why TanStack Start + edge runtimes are now the default for fast, type-safe product teams.",
    category: "article",
    date: "2026-06-12",
    readingMinutes: 7,
    author: "Ari Tanaka",
    cover: "linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #3b82f6 100%)",
    content: [
      "The shape of a great React stack has shifted again. Edge runtimes, streaming SSR and type-safe routing have crossed a maturity line.",
      "We rebuilt three production apps on TanStack Start over the past quarter. This is what we learned, what we'd do differently, and where the edge model still hurts.",
      "First, the wins: cold starts are gone, deep links work everywhere, and the loader / Query pattern eliminated an entire class of waterfall bugs we used to chase.",
    ],
  },
  {
    slug: "halo-case-study",
    title: "Case study: cutting Halo's legal research time by 71%",
    excerpt:
      "How we shipped a RAG copilot across 1.2M legal documents — and the evaluation harness behind it.",
    category: "case-study",
    date: "2026-05-28",
    readingMinutes: 11,
    author: "Sana Kazan",
    cover: "linear-gradient(135deg, #1a103d 0%, #4c1d95 50%, #a855f7 100%)",
    content: [
      "Halo's research team was spending 40% of billable hours navigating their own document store. They asked us to build a copilot that lawyers would actually trust.",
      "Trust was the constraint. Hallucinations were unacceptable; every answer had to cite a source.",
      "We built a hybrid retrieval pipeline, a structured citation layer, and an offline evaluation harness that runs on every deployment.",
    ],
  },
  {
    slug: "webxia-joins-figma-config",
    title: "WebXIA at Config 2026",
    excerpt: "We'll be in San Francisco for Config — drop by and say hello.",
    category: "news",
    date: "2026-05-15",
    readingMinutes: 2,
    author: "Léa Moreau",
    cover: "linear-gradient(135deg, #1a1a1a 0%, #3a2a1a 50%, #d4a574 100%)",
    content: [
      "We'll be at Figma Config from June 25 to 27. Three of the team will be on the ground.",
      "If you're working on a product launch or a brand system and want a real conversation, send us a note.",
    ],
  },
  {
    slug: "design-systems-for-small-teams",
    title: "Design systems for teams of three",
    excerpt:
      "You don't need a 4-person platform team. Here's the minimum viable design system we ship.",
    category: "article",
    date: "2026-04-30",
    readingMinutes: 9,
    author: "Noé Vidal",
    cover: "linear-gradient(135deg, #052e2b 0%, #064e3b 50%, #10b981 100%)",
    content: [
      "The mistake most teams make is to start with components. Start with tokens.",
      "Tokens — colour, type, spacing, motion — are the language. Components are sentences in that language.",
      "Get tokens right and your team will ship consistent UI without needing to ask. Get them wrong and a Figma library won't save you.",
    ],
  },
  {
    slug: "fieldkit-case-study",
    title: "Case study: FieldKit, offline-first for 4,000 operators",
    excerpt:
      "Building a React Native app that holds up in tunnels, basements and the back of trucks.",
    category: "case-study",
    date: "2026-04-10",
    readingMinutes: 8,
    author: "Ari Tanaka",
    cover: "linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #f59e0b 100%)",
    content: [
      "FieldKit operators work in places where connectivity drops without warning. The previous app lost data, often.",
      "We rebuilt around an offline-first sync model, a conflict-resolution layer, and an aggressive background queue.",
      "Six months in, data loss is zero. Average task time dropped 22%.",
    ],
  },
  {
    slug: "we-are-hiring-design-engineer",
    title: "We're hiring: senior design engineer",
    excerpt: "Full-time, remote within ±3h Paris. Equity, real ownership, no calendar tetris.",
    category: "news",
    date: "2026-03-22",
    readingMinutes: 3,
    author: "Léa Moreau",
    cover: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #6366f1 100%)",
    content: [
      "We're a small team and we're adding one senior design engineer. Someone who writes Figma and React with equal comfort.",
      "If that's you, see the full description and apply through the link in this post.",
    ],
  },
];
