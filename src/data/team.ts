export type Founder = {
  name: string;
  roleKey: string;
  bioKey: string;
  initials: string;
  photo: string;
};

export type ExpertisePole = {
  titleKey: string;
  descKey: string;
  icon: string;
};

export const founder: Founder = {
  name: "Mehdi E.",
  roleKey: "team.founder.role",
  bioKey: "team.founder.bio",
  initials: "ME",
  photo: "/images/mehdi.webp",
};

export const expertisePoles: ExpertisePole[] = [
  {
    titleKey: "team.poles.1.title",
    descKey: "team.poles.1.desc",
    icon: "code",
  },
  {
    titleKey: "team.poles.2.title",
    descKey: "team.poles.2.desc",
    icon: "palette",
  },
  {
    titleKey: "team.poles.3.title",
    descKey: "team.poles.3.desc",
    icon: "bot",
  },
  {
    titleKey: "team.poles.4.title",
    descKey: "team.poles.4.desc",
    icon: "trending-up",
  },
];
