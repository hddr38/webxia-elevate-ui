export type Member = {
  name: string;
  role: string;
  bio: string;
  initials: string;
  accent: string;
};

export const team: Member[] = [
  {
    name: "Léa Moreau",
    role: "Founder · Product & Strategy",
    bio: "12y shipping consumer and B2B products. Ex-design lead at two fintechs.",
    initials: "LM",
    accent: "linear-gradient(135deg, #3b82f6, #a855f7)",
  },
  {
    name: "Ari Tanaka",
    role: "Engineering Lead",
    bio: "TypeScript, edge runtimes, AI infrastructure. Open-source contributor.",
    initials: "AT",
    accent: "linear-gradient(135deg, #10b981, #06b6d4)",
  },
  {
    name: "Noé Vidal",
    role: "Design Director",
    bio: "Editorial design and motion. Built design systems for 30+ products.",
    initials: "NV",
    accent: "linear-gradient(135deg, #f59e0b, #ec4899)",
  },
  {
    name: "Sana Kazan",
    role: "AI Engineer",
    bio: "RAG, agents, evaluation. PhD in applied ML.",
    initials: "SK",
    accent: "linear-gradient(135deg, #6366f1, #d946ef)",
  },
];
