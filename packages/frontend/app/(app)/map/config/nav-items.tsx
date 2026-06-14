/**
 * Navigation Items Configuration
 */

import type { NavItem } from '../types';
import { HomeIcon, MapIcon, GraphIcon, ReportIcon, InfoIcon, PricingIcon, MarketsIcon } from '../components';

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon />, href: '/' },
  { id: 'maps', label: 'Maps', icon: <MapIcon />, href: '/map' },
  { id: 'markets', label: 'Markets', icon: <MarketsIcon />, href: '/market' },
  { id: 'graphs', label: 'Graphs', icon: <GraphIcon />, href: '/graphs' },
  { id: 'reports', label: 'Reports', icon: <ReportIcon />, href: '/reports' },
  { id: 'about', label: 'About Us', icon: <InfoIcon />, href: '/about' },
  { id: 'pricing', label: 'Pricing', icon: <PricingIcon />, href: '/pricing' },
];
