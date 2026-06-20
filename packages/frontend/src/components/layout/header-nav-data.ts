import React from "react";
import {
  HomeIcon,
  MapIcon,
  TrendingIcon,
  ArticleIcon,
  ScoreIcon,
  MoneyIcon,
  BookIcon,
  DataIcon,
  IntegrationIcon,
  InfoIcon,
  MarketsIcon,
  ChartIcon,
  ScreenerIcon,
  StarIcon,
} from "@/src/components/common/Icons";

/* ─── Types ─── */

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavDropdown {
  name: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavDropdown;

export function isDropdown(entry: NavEntry): entry is NavDropdown {
  return "items" in entry;
}

/* ─── Nav config ─── */

export const NAV: NavEntry[] = [
  { name: "Home", href: "/", icon: HomeIcon },
  {
    name: "Explore",
    items: [
      { name: "Maps", href: "/map", icon: MapIcon },
      { name: "Markets", href: "/market", icon: MarketsIcon },
      { name: "Screener", href: "/screener", icon: ScreenerIcon },
      { name: "Graphs", href: "/graphs", icon: TrendingIcon },
    ],
  },
  { name: "Reports", href: "/reports", icon: ArticleIcon },
  { name: "Analyzer", href: "/analyzer", icon: ChartIcon },
  { name: "Scores", href: "/scores", icon: ScoreIcon },
  { name: "Pricing", href: "/pricing", icon: MoneyIcon },
  {
    name: "More",
    items: [
      { name: "Compare", href: "/compare", icon: StarIcon },
      { name: "Blog", href: "/blog", icon: BookIcon },
      { name: "API Docs", href: "/docs/api", icon: DataIcon },
      { name: "MCP Integration", href: "/docs/mcp", icon: IntegrationIcon },
      { name: "About us", href: "/about", icon: InfoIcon },
    ],
  },
];

/** Flat list of all nav items for mobile menu and active-state detection */
export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((entry) =>
  isDropdown(entry) ? entry.items : [entry],
);
