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

import type { MetricCategory, ViewMode, Metric } from "../types";
import { getMetricConfig } from "./metrics";
import {
  AttachMoneyIcon,
  ShowChartIcon,
  PeopleIcon,
  AnalyticsIcon,
} from "../components";
import {
  EconomicIcon,
  SpeedIcon,
  WalletIcon,
  GrowthIcon,
  ShieldIcon,
  ConstructionIcon,
} from "./metric-category-icons";

/**
 * Create a metric entry from the central config.
 * Premium/locked status is determined by the entitlements system at runtime.
 */
function metric(id: string, flags?: { isNew?: boolean }): Metric {
  const config = getMetricConfig(id);
  return {
    id,
    name:
      config?.title ||
      id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    dataSource: config?.dataSource,
    isNew: flags?.isNew,
  };
}

// ============================================================================
// HOMEBUYER CATEGORIES
// ============================================================================

const HOMEBUYER_AFFORDABILITY: MetricCategory = {
  id: "affordability",
  name: "Affordability",
  subtext: "Can I afford to live here?",
  icon: <AttachMoneyIcon />,
  metrics: [
    metric("listing_price"),
    metric("home_value"),
    metric("income_to_buy"),
    metric("affordable_home_price"),
    metric("price_per_sqft"),
    metric("years_to_save"),
    metric("rent_index"),
    metric("income_to_rent"),
    metric("home_value_yoy"),
    metric("home_value_5yr"),
  ],
};

const HOMEBUYER_COMPETITION: MetricCategory = {
  id: "market_competition",
  name: "Market Competition",
  subtext: "Should I act fast?",
  icon: <SpeedIcon />,
  metrics: [
    metric("days_on_market"),
    metric("months_of_supply"),
    metric("for_sale_inventory"),
    metric("inventory_yoy"),
    metric("pending_ratio"),
    metric("pending_listings"),
    metric("new_listings_yoy"),
    metric("home_sales"),
    metric("home_sales_yoy"),
    metric("hotness_score"),
    metric("market_heat"),
    metric("supply_score"),
    metric("demand_score"),
  ],
};

const HOMEBUYER_PRICING: MetricCategory = {
  id: "pricing_deals",
  name: "Pricing & Deals",
  subtext: "Are prices going up or down?",
  icon: <ShowChartIcon />,
  metrics: [
    metric("home_value_yoy"),
    metric("home_value_mom"),
    metric("home_price_forecast"),
    metric("price_cut_pct"),
    metric("price_increase_pct"),
    metric("new_listings"),
    metric("inventory_surplus"),
    metric("sold_above_list_share"),
    metric("listings_delisted_share"),
    metric("pending_cancellation_share"),
  ],
};

// ============================================================================
// INVESTOR CATEGORIES
// ============================================================================

const INVESTOR_CASHFLOW: MetricCategory = {
  id: "cash_flow",
  name: "Cash Flow",
  subtext: "Will this make money monthly?",
  icon: <WalletIcon />,
  metrics: [
    metric("cap_rate"),
    metric("gross_yield"),
    metric("grm"),
    metric("rent_to_price_ratio"),
    metric("rent_index"),
    metric("rent_for_houses"),
    metric("listing_price"),
    metric("price_per_sqft"),
    metric("investor_market_share"),
    metric("all_cash_share"),
  ],
};

const INVESTOR_APPRECIATION: MetricCategory = {
  id: "appreciation",
  name: "Appreciation",
  subtext: "Will the value grow?",
  icon: <GrowthIcon />,
  metrics: [
    metric("home_value_yoy"),
    metric("home_value_5yr"),
    metric("home_price_forecast"),
    metric("home_value"),
    metric("overvalued_pct"),
  ],
};

const INVESTOR_DEMAND_RISK: MetricCategory = {
  id: "demand_risk",
  name: "Demand & Risk",
  subtext: "Can I rent/sell it?",
  icon: <ShieldIcon />,
  metrics: [
    metric("days_on_market"),
    metric("months_of_supply"),
    metric("for_sale_inventory"),
    metric("inventory_yoy"),
    metric("pending_ratio"),
    metric("pending_listings"),
    metric("new_listings_yoy"),
    metric("home_sales"),
    metric("hotness_score"),
    metric("market_heat"),
    metric("supply_score"),
    metric("demand_score"),
  ],
};

// ============================================================================
// SHARED CATEGORIES (shown in both views after divider)
// ============================================================================

const DIVIDER_CATEGORY: MetricCategory = {
  id: "divider",
  name: "",
  icon: null,
  isDivider: true,
};

const AREA_PROFILE: MetricCategory = {
  id: "area_profile",
  name: "Area Profile",
  subtext: "Who lives here?",
  icon: <PeopleIcon />,
  metrics: [
    metric("population"),
    metric("population_growth"),
    metric("median_income"),
    metric("income_growth"),
    metric("median_age"),
    metric("homeownership_rate"),
  ],
};

const LOCAL_ECONOMY: MetricCategory = {
  id: "local_economy",
  name: "Local Economy",
  subtext: "How strong is the job market?",
  icon: <EconomicIcon />,
  metrics: [
    metric("unemployment_rate"),
    metric("job_growth"),
    metric("gdp_growth"),
    metric("cost_of_living"),
  ],
};

const NEW_CONSTRUCTION: MetricCategory = {
  id: "new_construction",
  name: "New Construction",
  subtext: "What new homes are being built?",
  icon: <ConstructionIcon />,
  metrics: [
    // Building Permits (Census BPS - state/county)
    metric("sf_permits"),
    metric("mf_permits"),
    metric("total_permits"),
    metric("permits_yoy"),
    metric("sf_mf_ratio"),
    metric("permit_value_per_unit"),
    // New Construction Sales (Zillow - metro only)
    metric("new_construction_sales"),
    metric("new_construction_ppsf"),
  ],
};

// ============================================================================
// PROPERTYIQ SCORES (always at bottom)
// ============================================================================

export const SCORES_CATEGORY: MetricCategory = {
  id: "scores",
  name: "PropertyIQ Scores",
  subtext: "AI-powered market analysis",
  icon: <AnalyticsIcon />,
  metrics: [metric("propertyiq_score")],
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
  if (viewMode === "homebuyer") {
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
    SCORES_CATEGORY,
  ];

  const ids = new Set<string>();
  categories.forEach((cat) => {
    cat.metrics?.forEach((m) => ids.add(m.id));
  });

  return Array.from(ids);
}

// Legacy exports for backwards compatibility
export const METRIC_CATEGORIES: MetricCategory[] =
  getMetricCategories("homebuyer");
export const SHARED_CATEGORIES: MetricCategory[] = [
  AREA_PROFILE,
  LOCAL_ECONOMY,
  NEW_CONSTRUCTION,
];
export const INVESTOR_CATEGORIES: MetricCategory[] = [
  INVESTOR_CASHFLOW,
  INVESTOR_APPRECIATION,
  INVESTOR_DEMAND_RISK,
];
export function getPopularDataCategory(viewMode: ViewMode): MetricCategory {
  return viewMode === "homebuyer" ? HOMEBUYER_AFFORDABILITY : INVESTOR_CASHFLOW;
}
