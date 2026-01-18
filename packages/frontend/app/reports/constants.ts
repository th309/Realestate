import {
  BarChart3,
  GitCompare,
  PiggyBank,
  Users,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import type { ReportType, SubscriptionTier, UserType } from './types';

// Template icon mapping
export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  BarChart3,
  GitCompare,
  PiggyBank,
  Users,
  Activity,
};

// Template descriptions for display
export const TEMPLATE_INFO: Record<ReportType, {
  name: string;
  shortDescription: string;
  userTypeRelevance: Record<UserType, number>; // 1 = primary, 2 = secondary
}> = {
  snapshot: {
    name: 'Market Snapshot',
    shortDescription: 'Quick pulse on any single market',
    userTypeRelevance: { homebuyer: 1, investor: 1 },
  },
  comparison: {
    name: 'Market Comparison',
    shortDescription: 'Side-by-side comparison of 2-5 markets',
    userTypeRelevance: { homebuyer: 2, investor: 2 },
  },
  investment: {
    name: 'Investment Analysis',
    shortDescription: 'Deep dive for investors with pro forma',
    userTypeRelevance: { homebuyer: 3, investor: 1 },
  },
  affordability: {
    name: 'Affordability & Migration',
    shortDescription: 'Demographics and population flow analysis',
    userTypeRelevance: { homebuyer: 1, investor: 2 },
  },
  cycle: {
    name: 'Market Cycle & Risk',
    shortDescription: 'Cycle position and scenario analysis',
    userTypeRelevance: { homebuyer: 2, investor: 1 },
  },
};

// Tier display configuration
export const TIER_INFO: Record<SubscriptionTier, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  free: {
    label: 'Free',
    color: 'text-on-surface-variant',
    bgColor: 'bg-surface-container',
  },
  basic: {
    label: 'Basic',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  pro: {
    label: 'Pro',
    color: 'text-tertiary',
    bgColor: 'bg-tertiary/10',
  },
  enterprise: {
    label: 'Enterprise',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
};

// Wizard step configuration
export const WIZARD_STEPS = [
  { id: 1, name: 'Select Template', description: 'Choose your report type' },
  { id: 2, name: 'Select Market', description: 'Pick geography' },
  { id: 3, name: 'Customize', description: 'Add your details' },
  { id: 4, name: 'Review', description: 'Generate report' },
] as const;

// User type configuration
export const USER_TYPE_CONFIG: Record<UserType, {
  label: string;
  description: string;
  heroScore: 'homeready' | 'investoredge';
  icon: string;
}> = {
  homebuyer: {
    label: 'Homebuyer / Renter',
    description: 'Looking to buy or rent a home',
    heroScore: 'homeready',
    icon: 'Home',
  },
  investor: {
    label: 'Investor',
    description: 'Looking to invest in real estate',
    heroScore: 'investoredge',
    icon: 'TrendingUp',
  },
};

// Score labels and descriptions
export const SCORE_INFO: Record<string, {
  name: string;
  description: string;
  color: string;
  bgClass: string;
}> = {
  homeready: {
    name: 'HomeReady Score',
    description: 'Measures how favorable a market is for homebuyers and renters',
    color: 'text-primary',
    bgClass: 'bg-primary',
  },
  investoredge: {
    name: 'InvestorEdge Score',
    description: 'Measures investment potential based on cash flow and appreciation',
    color: 'text-tertiary',
    bgClass: 'bg-tertiary',
  },
  // Uppercase aliases for component usage
  HomeReady: {
    name: 'HomeReady Score',
    description: 'Measures how favorable a market is for homebuyers and renters',
    color: 'text-primary',
    bgClass: 'bg-primary',
  },
  InvestorEdge: {
    name: 'InvestorEdge Score',
    description: 'Measures investment potential based on cash flow and appreciation',
    color: 'text-tertiary',
    bgClass: 'bg-tertiary',
  },
};

// Geography level options
export const GEO_LEVEL_OPTIONS = [
  { value: 'metro', label: 'Metro Area' },
  { value: 'county', label: 'County' },
  { value: 'zip', label: 'ZIP Code' },
] as const;
