/**
 * Metric Categories Configuration
 *
 * Categories organize metrics into UI groups for the sidebar.
 * Restructured with user-centric questions:
 * - Homebuyer: "Can I afford to live here?", "Should I act fast?", etc.
 * - Investor: "Will this make money monthly?", "Will the value grow?", etc.
 *
 * Data Source Strategy (Realtor-first):
 * - Realtor: Primary source for listings, inventory, DOM, price dynamics (best coverage)
 * - Zillow: Specialty data - rent, forecasts, affordability, new construction
 * - Calculated: Derived metrics using formulas from base data
 */

import type { MetricCategory, ViewMode, Metric } from '../types';
import { getMetricConfig } from './metrics';
import {
  AttachMoneyIcon, ShowChartIcon, PeopleIcon, AnalyticsIcon
} from '../components';

// Icon for Economic Context / Local Economy
const EconomicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h80v-280h-80v280Zm160 0h80v-400h-80v400Zm160 0h80v-160h-80v160Z" />
  </svg>
);

// Icon for Competition / Speed
const SpeedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="m422-232 207-248H469l29-227-185 267h139l-30 208ZM320-80l40-280H160l360-520h80l-40 320h240L400-80h-80Zm151-390Z" />
  </svg>
);

// Icon for Cash Flow
const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v100h-80v-100H200v560h560v-100h80v100q0 33-23.5 56.5T760-120H200Zm320-160q-33 0-56.5-23.5T440-360v-240q0-33 23.5-56.5T520-680h280q33 0 56.5 23.5T880-600v240q0 33-23.5 56.5T800-280H520Zm280-80v-240H520v240h280Zm-160-60q25 0 42.5-17.5T700-480q0-25-17.5-42.5T640-540q-25 0-42.5 17.5T580-480q0 25 17.5 42.5T640-420Z" />
  </svg>
);

// Icon for Appreciation / Growth
const GrowthIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M120-120v-80l80-80v160h-80Zm160 0v-240l80-80v320h-80Zm160 0v-320l80 81v239h-80Zm160 0v-239l80-80v319h-80Zm160 0v-400l80-80v480h-80ZM120-327v-113l280-280 160 160 280-280v113L560-447 400-607 120-327Z" />
  </svg>
);

// Icon for Risk / Shield
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z" />
  </svg>
);

// Icon for Building / Construction
const ConstructionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M120-120v-560h200v-160h320v320h200v400H560v-200H400v200H120Zm80-80h120v-120H200v120Zm0-200h120v-120H200v120Zm0-200h120v-120H200v120Zm200 200h120v-120H400v120Zm0-200h120v-120H400v120Zm0-200h120v-120H400v120Zm200 400h120v-120H600v120Zm0-200h120v-120H600v120Z" />
  </svg>
);

/**
 * Create a metric entry from the central config.
 * Only specify isPremium/isNew here - name and dataSource come from METRICS.
 */
function metric(id: string, flags?: { isPremium?: boolean; isNew?: boolean }): Metric {
  const config = getMetricConfig(id);
  return {
    id,
    name: config?.title || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    dataSource: config?.dataSource,
    isPremium: flags?.isPremium,
    isNew: flags?.isNew,
  };
}

// ============================================================================
// HOMEBUYER CATEGORIES
// ============================================================================

const HOMEBUYER_AFFORDABILITY: MetricCategory = {
  id: 'affordability',
  name: 'Affordability',
  subtext: 'Can I afford to live here?',
  icon: <AttachMoneyIcon />,
  metrics: [
    metric('listing_price', { isNew: true }),
    metric('income_to_buy', { isNew: true }),
    metric('affordable_home_price', { isNew: true }),
    metric('price_per_sqft', { isNew: true }),
    metric('years_to_save', { isPremium: true, isNew: true }),
    metric('home_value_yoy'),
    metric('home_value_5yr', { isPremium: true }),
  ],
};

const HOMEBUYER_COMPETITION: MetricCategory = {
  id: 'market_competition',
  name: 'Market Competition',
  subtext: 'Should I act fast?',
  icon: <SpeedIcon />,
  metrics: [
    metric('days_on_market'),
    metric('for_sale_inventory'),
    metric('inventory_yoy'),
    metric('pending_ratio'),
    metric('new_listings_yoy', { isNew: true }),
    metric('hotness_score', { isNew: true }),
    metric('sale_to_list', { isPremium: true }),
  ],
};

const HOMEBUYER_PRICING: MetricCategory = {
  id: 'pricing_deals',
  name: 'Pricing & Deals',
  subtext: 'Are prices going up or down?',
  icon: <ShowChartIcon />,
  metrics: [
    metric('home_value_yoy'),
    metric('home_value_mom', { isPremium: true }),
    metric('price_cut_pct'),
    metric('price_increase_pct', { isNew: true }),
    metric('new_listings'),
    metric('inventory_surplus', { isPremium: true }),
  ],
};

// ============================================================================
// INVESTOR CATEGORIES
// ============================================================================

const INVESTOR_CASHFLOW: MetricCategory = {
  id: 'cash_flow',
  name: 'Cash Flow',
  subtext: 'Will this make money monthly?',
  icon: <WalletIcon />,
  metrics: [
    metric('cap_rate', { isPremium: true }),
    metric('rent_index'),
    metric('rent_for_houses'),
    metric('listing_price', { isNew: true }),
    metric('price_per_sqft', { isNew: true }),
  ],
};

const INVESTOR_APPRECIATION: MetricCategory = {
  id: 'appreciation',
  name: 'Appreciation',
  subtext: 'Will the value grow?',
  icon: <GrowthIcon />,
  metrics: [
    metric('home_value_yoy'),
    metric('home_value_5yr', { isPremium: true }),
    metric('home_value'),
    metric('overvalued_pct', { isPremium: true }),
  ],
};

const INVESTOR_DEMAND_RISK: MetricCategory = {
  id: 'demand_risk',
  name: 'Demand & Risk',
  subtext: 'Can I rent/sell it?',
  icon: <ShieldIcon />,
  metrics: [
    metric('days_on_market'),
    metric('for_sale_inventory'),
    metric('inventory_yoy'),
    metric('pending_ratio'),
    metric('new_listings_yoy', { isNew: true }),
    metric('hotness_score', { isNew: true }),
  ],
};

// ============================================================================
// SHARED CATEGORIES (shown in both views after divider)
// ============================================================================

const DIVIDER_CATEGORY: MetricCategory = {
  id: 'divider',
  name: '',
  icon: null,
  isDivider: true,
};

const AREA_PROFILE: MetricCategory = {
  id: 'area_profile',
  name: 'Area Profile',
  subtext: 'Who lives here?',
  icon: <PeopleIcon />,
  metrics: [
    metric('population'),
    metric('population_growth', { isPremium: true }),
    metric('median_income'),
    metric('income_growth', { isPremium: true }),
    metric('median_age', { isPremium: true }),
    metric('homeownership_rate', { isPremium: true }),
  ],
};

const LOCAL_ECONOMY: MetricCategory = {
  id: 'local_economy',
  name: 'Local Economy',
  subtext: 'How strong is the job market?',
  icon: <EconomicIcon />,
  metrics: [
    metric('unemployment_rate'),
    metric('job_growth', { isPremium: true }),
    metric('gdp_growth', { isPremium: true }),
    metric('cost_of_living', { isPremium: true }),
  ],
};

const NEW_CONSTRUCTION: MetricCategory = {
  id: 'new_construction',
  name: 'New Construction',
  subtext: 'What new homes are being built?',
  icon: <ConstructionIcon />,
  metrics: [
    // Building Permits (Census BPS - state/county)
    metric('sf_permits', { isNew: true }),
    metric('mf_permits', { isNew: true }),
    metric('total_permits', { isNew: true }),
    metric('permits_yoy', { isNew: true }),
    metric('sf_mf_ratio', { isPremium: true, isNew: true }),
    metric('permit_value_per_unit', { isPremium: true, isNew: true }),
    // New Construction Sales (Zillow - metro only)
    metric('new_construction_sales'),
    metric('new_construction_price'),
    metric('new_construction_ppsf', { isPremium: true }),
  ],
};

// ============================================================================
// PROPERTYIQ SCORES (always at bottom)
// ============================================================================

export const SCORES_CATEGORY: MetricCategory = {
  id: 'scores',
  name: 'PropertyIQ Scores',
  subtext: 'AI-powered market analysis',
  icon: <AnalyticsIcon />,
  isNew: true,
  metrics: [
    metric('homeready_score', { isPremium: true, isNew: true }),
    metric('investoredge_score', { isPremium: true, isNew: true }),
    metric('market_health_score', { isPremium: true }),
  ],
};

// ============================================================================
// CATEGORY GETTERS
// ============================================================================

/**
 * Get all categories for a given view mode
 *
 * Homebuyer: Affordability, Market Competition, Pricing & Deals, [divider], Area Profile, Local Economy, New Construction, Scores
 * Investor: Cash Flow, Appreciation, Demand & Risk, [divider], Area Profile, Local Economy, New Construction, Scores
 */
export function getMetricCategories(viewMode: ViewMode): MetricCategory[] {
  if (viewMode === 'homebuyer') {
    return [
      HOMEBUYER_AFFORDABILITY,
      HOMEBUYER_COMPETITION,
      HOMEBUYER_PRICING,
      DIVIDER_CATEGORY,
      AREA_PROFILE,
      LOCAL_ECONOMY,
      NEW_CONSTRUCTION,
      SCORES_CATEGORY,
    ];
  }

  // Investor view
  return [
    INVESTOR_CASHFLOW,
    INVESTOR_APPRECIATION,
    INVESTOR_DEMAND_RISK,
    DIVIDER_CATEGORY,
    AREA_PROFILE,
    LOCAL_ECONOMY,
    NEW_CONSTRUCTION,
    SCORES_CATEGORY,
  ];
}


// ============================================================================
// HELPER: Get flat list of all metric IDs in order
// ============================================================================

export function getAllOrderedMetricIds(): string[] {
  // Use Homebuyer view as the primary order source (contains all metrics except maybe some investor-specific ones?)
  // Actually, let's combine categories intelligently or just use the homebuyer set if it covers everything.
  // Looking at the file, both views share most categories.
  // Let's iterate through the categories provided by getMetricCategories('homebuyer') plus any unique ones from investor?
  // Current logic in useMetricOptions.ts seemed to try to list them all.

  // Let's just walk the categories in 'homebuyer' view + 'scores' (which is in both).
  // Check if Investor has unique attributes.
  // Investor has Cash Flow, Appreciation, Demand/Risk.
  // Homebuyer has Affordability, Competition, Pricing.
  // They cover slightly different sets or verify if they overlap 100%.

  // Strategy: Collect from all category definitions directly.
  const categories = [
    // Homebuyer
    HOMEBUYER_AFFORDABILITY,
    HOMEBUYER_COMPETITION,
    HOMEBUYER_PRICING,
    // Investor
    INVESTOR_CASHFLOW,
    INVESTOR_APPRECIATION,
    INVESTOR_DEMAND_RISK,
    // Shared
    AREA_PROFILE,
    LOCAL_ECONOMY,
    NEW_CONSTRUCTION,
    SCORES_CATEGORY
  ];

  const ids = new Set<string>();
  categories.forEach(cat => {
    cat.metrics?.forEach(m => ids.add(m.id));
  });

  return Array.from(ids);
}

// Legacy exports for backwards compatibility
export const METRIC_CATEGORIES: MetricCategory[] = getMetricCategories('homebuyer');
export const SHARED_CATEGORIES: MetricCategory[] = [AREA_PROFILE, LOCAL_ECONOMY, NEW_CONSTRUCTION];
export const INVESTOR_CATEGORIES: MetricCategory[] = [INVESTOR_CASHFLOW, INVESTOR_APPRECIATION, INVESTOR_DEMAND_RISK];
export function getPopularDataCategory(viewMode: ViewMode): MetricCategory {
  return viewMode === 'homebuyer' ? HOMEBUYER_AFFORDABILITY : INVESTOR_CASHFLOW;
}

