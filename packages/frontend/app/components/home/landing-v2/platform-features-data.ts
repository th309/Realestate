import {
  BarChart3,
  Map,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { formatMarketsScored } from "@/lib/data";

/**
 * Card content for the homepage "Platform" band, kept beside the component so
 * PlatformFeatures.tsx stays purely presentational (CLAUDE.md §1.3).
 *
 * The PropertyIQ Score card's stat is headline coverage copy, so it is derived
 * from formatMarketsScored() rather than written as a literal — CLAUDE.md §9
 * forbids hardcoding raw coverage counts anywhere in the app. The other five
 * stats are static product facts, not coverage claims.
 */

export const PLATFORM_CATEGORIES = [
  "Scoring & Forecasts",
  "Maps & Discovery",
  "AI & Delivery",
] as const;

export type PlatformCategory = (typeof PLATFORM_CATEGORIES)[number];

export type PlatformFeature = {
  /** lucide-react icon component — never an emoji. */
  icon: LucideIcon;
  /** Semantic container/on-container token pair for the icon tile. */
  tileTone: string;
  title: string;
  description: string;
  /** Monospace line pinned to the bottom of the card. */
  stat: string;
  category: PlatformCategory;
};

export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    icon: Target,
    tileTone: "bg-tertiary-container text-tertiary",
    title: "PropertyIQ Score",
    description:
      "Cross-sectional rank of price momentum, days on market, and price cuts, recalibrated monthly against each market's state.",
    stat: `${formatMarketsScored()} markets scored`,
    category: "Scoring & Forecasts",
  },
  {
    icon: BarChart3,
    tileTone: "bg-primary-container text-primary",
    title: "Validated backtest",
    description:
      "Published accuracy, not marketing claims. Every score band's realized excess return is measured and disclosed.",
    stat: "History back to 2001",
    category: "Scoring & Forecasts",
  },
  {
    icon: TrendingUp,
    tileTone: "bg-warning-container text-on-warning-container",
    title: "Home value forecasts",
    description:
      "Twelve-month forward projections alongside the score, so momentum and expectation sit side by side.",
    stat: "Metro · county · ZIP",
    category: "Scoring & Forecasts",
  },
  {
    icon: Map,
    tileTone: "bg-accent-teal-container text-accent-teal",
    title: "Interactive map",
    description:
      "Sixty-plus metrics rendered nationally with dynamic color scales — no fixed breakpoints hiding the spread.",
    stat: "60+ metrics",
    category: "Maps & Discovery",
  },
  {
    icon: Search,
    tileTone: "bg-accent-violet-container text-accent-violet",
    title: "Market screener",
    description:
      "Filter the full universe on yield, momentum, supply, and score, then drill into any result.",
    stat: "Save & alert on any screen",
    category: "Maps & Discovery",
  },
  {
    icon: Sparkles,
    tileTone: "bg-primary-container text-primary",
    title: "MCP for Claude",
    description:
      "Query every market directly from Claude or ChatGPT. Around fifty tools, no copy-paste.",
    stat: "~50 MCP tools",
    category: "AI & Delivery",
  },
];
