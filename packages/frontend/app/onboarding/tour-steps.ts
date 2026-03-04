export interface TourStep {
  id: string;
  route: string | null;
  targetSelector: string | null;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  highlight?: boolean;
}

export const DEFAULT_DEMO_MARKET = {
  geoId: "19100",
  name: "Dallas-Fort Worth, TX",
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/map",
    targetSelector: null,
    title: "Welcome to PropertyIQ",
    body: "Let's take a quick tour of the platform. We'll show you how to explore markets, understand scores, and use our analysis tools. Takes about 2 minutes.",
    placement: "center",
  },
  {
    id: "search-bar",
    route: null,
    targetSelector: '[data-tour="search-bar"]',
    title: "Search Any Market",
    body: "Type a city, ZIP code, or metro area to jump straight to the market you're interested in.",
    placement: "bottom",
  },
  {
    id: "metric-sidebar",
    route: null,
    targetSelector: '[data-tour="metric-sidebar"]',
    title: "Explore Market Data",
    body: "Choose from 30+ metrics like Home Value, Rent Index, and Market Heat to color-code the map. Switch geography levels to zoom into the data.",
    placement: "right",
  },
  {
    id: "map-region",
    route: null,
    targetSelector: '[data-tour="map-area"]',
    title: "Dive Into a Market",
    body: "Click any region on the map to see detailed stats and PropertyIQ scores for that area.",
    placement: "top",
  },
  {
    id: "scores",
    route: "/scores",
    targetSelector: '[data-tour="score-cards"]',
    title: "PropertyIQ Scores",
    body: "Every market gets a score from 0-100. HomeReady measures homebuyer opportunity. InvestorEdge measures rental investment potential. The letter badge shows data confidence.",
    placement: "bottom",
  },
  {
    id: "graphs",
    route: "/graphs",
    targetSelector: '[data-tour="chart-area"]',
    title: "Interactive Charts",
    body: "Visualize trends over time for any metric. Compare regions, spot patterns, and track how markets are changing.",
    placement: "bottom",
  },
  {
    id: "ai-assessment",
    route: null,
    targetSelector: '[data-tour="ai-assessment"]',
    title: "AI-Powered Market Intelligence",
    body: "This is what sets PropertyIQ apart. Our AI analyzes dozens of data points to give you a plain-English assessment of any market — opportunities, risks, and outlook. No other platform does this.",
    placement: "top",
    highlight: true,
  },
  {
    id: "reports",
    route: "/reports",
    targetSelector: '[data-tour="reports-section"]',
    title: "Market Reports",
    body: "Generate detailed reports for any market. Reports combine scores, trends, and key metrics into a shareable document.",
    placement: "bottom",
  },
  {
    id: "complete",
    route: null,
    targetSelector: null,
    title: "You're All Set!",
    body: "That's the essentials. Explore on your own — you can restart this tour anytime from the Help menu.",
    placement: "center",
  },
];
