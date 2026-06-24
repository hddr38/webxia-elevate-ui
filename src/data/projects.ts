export type ProjectCategory = "web" | "app" | "ai" | "brand";

export type Project = {
  slug: string;
  client: string;
  title: string;
  category: ProjectCategory;
  year: string;
  tags: string[];
  /** CSS gradient used as cover placeholder */
  cover: string;
  summary: string;
};

export const projects: Project[] = [
  {
    slug: "northwind-platform",
    client: "Northwind",
    title: "A trading platform rebuilt for speed",
    category: "web",
    year: "2025",
    tags: ["React", "TanStack", "Edge"],
    cover: "linear-gradient(135deg, #0b1220 0%, #1e293b 40%, #3b82f6 100%)",
    summary: "Sub-second navigation across 12k pages with edge rendering.",
  },
  {
    slug: "halo-ai-copilot",
    client: "Halo",
    title: "AI copilot for legal teams",
    category: "ai",
    year: "2025",
    tags: ["RAG", "OpenAI", "Vector"],
    cover: "linear-gradient(135deg, #1a103d 0%, #4c1d95 50%, #a855f7 100%)",
    summary: "Custom retrieval pipeline over 1.2M legal documents.",
  },
  {
    slug: "atelier-marais",
    client: "Atelier Marais",
    title: "Editorial brand and e-commerce",
    category: "brand",
    year: "2024",
    tags: ["Identity", "Shopify", "Motion"],
    cover: "linear-gradient(135deg, #1a1a1a 0%, #3a2a1a 50%, #d4a574 100%)",
    summary: "A Parisian atelier redefined for a global audience.",
  },
  {
    slug: "fieldkit-mobile",
    client: "FieldKit",
    title: "Mobile-first field operations app",
    category: "app",
    year: "2024",
    tags: ["React Native", "Offline", "Maps"],
    cover: "linear-gradient(135deg, #052e2b 0%, #064e3b 50%, #10b981 100%)",
    summary: "Offline-first tooling for 4,000 field operators.",
  },
  {
    slug: "lumen-saas",
    client: "Lumen",
    title: "Analytics SaaS launch",
    category: "web",
    year: "2024",
    tags: ["Marketing", "SEO", "CMS"],
    cover: "linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #f59e0b 100%)",
    summary: "Marketing site shipped in 6 weeks, +180% sign-ups.",
  },
  {
    slug: "pulse-agent",
    client: "Pulse",
    title: "Autonomous support agent",
    category: "ai",
    year: "2025",
    tags: ["Agents", "Tools", "Eval"],
    cover: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #6366f1 100%)",
    summary: "Resolves 62% of tier-1 support tickets autonomously.",
  },
  {
    slug: "ovida-clinic",
    client: "Ovida",
    title: "Booking platform for clinics",
    category: "app",
    year: "2024",
    tags: ["Next.js", "Supabase", "Stripe"],
    cover: "linear-gradient(135deg, #0a0a23 0%, #1e3a8a 50%, #38bdf8 100%)",
    summary: "Booking + patient portal serving 28 clinics.",
  },
  {
    slug: "rivier-identity",
    client: "Rivier",
    title: "Brand system for a fintech",
    category: "brand",
    year: "2025",
    tags: ["Identity", "Design system", "Web"],
    cover: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #c084fc 100%)",
    summary: "Identity, design system and marketing site in 8 weeks.",
  },
  {
    slug: "kairos-search",
    client: "Kairos",
    title: "Semantic search for media",
    category: "ai",
    year: "2025",
    tags: ["Embeddings", "Hybrid search"],
    cover: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #ec4899 100%)",
    summary: "Hybrid semantic + keyword search across 9M assets.",
  },
];
