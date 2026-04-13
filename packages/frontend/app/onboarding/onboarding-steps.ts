export interface OnboardingStep {
  id: string;
  route: string | null;
  targetSelector: string | null;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  actionSelector?: string;
  actionEvent?: string;
  personaBody?: Record<string, string>;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "persona-search",
    route: "/get-started",
    targetSelector: null,
    title: "Let's find your first market",
    body: "Search for a city, metro, or ZIP you're interested in.",
    placement: "center",
  },
  {
    id: "view-score",
    route: null,
    targetSelector: '[data-tour="propertyiq-score"]',
    title: "Your market's PropertyIQ Score",
    body: "This score measures market demand relative to the state average. Higher is stronger.",
    placement: "right",
    actionSelector: '[data-tour="propertyiq-score"]',
    actionEvent: "click",
    personaBody: {
      investor:
        "This is your investment signal — higher scores mean stronger demand and competition.",
      homebuyer:
        "This shows market opportunity — how competitive this area is for buyers right now.",
      agent:
        "Use this score to identify hot markets and advise your clients on timing.",
    },
  },
  {
    id: "generate-report",
    route: "/reports",
    targetSelector: '[data-tour="reports-generate-btn"]',
    title: "Generate your free AI report",
    body: "Get a detailed market analysis powered by PropertyIQ's AI — scores, trends, and insights.",
    placement: "bottom",
    actionSelector: '[data-tour="reports-generate-btn"]',
    actionEvent: "click",
  },
  {
    id: "upgrade-cta",
    route: null,
    targetSelector: null,
    title: "You're set up with Pro access",
    body: "You have 14 days of full Pro — unlimited reports, ZIP-level data, market alerts, and AI chat. Explore everything.",
    placement: "center",
  },
];
