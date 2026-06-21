/**
 * Navigation Items Configuration
 */

import type { NavItem } from "../types";
import {
  HomeIcon,
  MapIcon,
  ShowChartIcon,
  ReportIcon,
  InfoIcon,
  PricingIcon,
  MarketsIcon,
  AttachMoneyIcon,
} from "../components";

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: <HomeIcon />, href: "/" },
  { id: "maps", label: "Maps", icon: <MapIcon />, href: "/map" },
  {
    id: "analyzer",
    label: "Analyzer",
    icon: <AttachMoneyIcon />,
    href: "/analyzer",
  },
  { id: "markets", label: "Markets", icon: <MarketsIcon />, href: "/market" },
  { id: "graphs", label: "Graphs", icon: <ShowChartIcon />, href: "/graphs" },
  { id: "reports", label: "Reports", icon: <ReportIcon />, href: "/reports" },
  { id: "about", label: "About Us", icon: <InfoIcon />, href: "/about" },
  { id: "pricing", label: "Pricing", icon: <PricingIcon />, href: "/pricing" },
];
