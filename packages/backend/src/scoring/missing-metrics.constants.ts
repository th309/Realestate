/** Missing-metrics strategy configuration and types for scoring v3.0. */

import { NullStrategy } from './scoring.types';

export interface MissingMetricResult {
  strategy: NullStrategy;
  score: number | null;
  includeInWeight: boolean;
  message?: string;
}

export interface ComponentAvailability {
  available: boolean;
  reason?: string;
  availableWeight: number;
  totalWeight: number;
  completeness: number;
}

export interface ScoreAvailability {
  available: boolean;
  status: 'complete' | 'partial' | 'unavailable';
  reason?: string;
  completeness: number;
  missingComponents: string[];
}

// Strategy configuration for each metric (v3.0)
// - Redfin features: 'skip' (market activity; biased if absent)
// - Census features: 'neutral' (structural, slow-moving)
// - Economic/Zillow: 'neutral'
// - Calculated affordability: 'neutral' (slow-moving ratio)
// - FRED macro / Realtor: 'skip' (market-sensitive or possibly unavailable)
export const METRIC_MISSING_STRATEGIES: Record<string, NullStrategy> = {
  // Redfin market activity metrics — skip (biased if absent)
  rf_median_dom: 'skip',
  rf_off_market_in_two_weeks: 'skip',
  rf_sold_above_list: 'skip',
  rf_avg_sale_to_list: 'skip',
  rf_homes_sold_yoy: 'skip',
  rf_sold_above_list_yoy: 'skip',
  rf_avg_sale_to_list_yoy: 'skip',
  rf_median_dom_yoy: 'skip',

  // Census demographic metrics — neutral (structural, slow-moving)
  cen_median_age: 'neutral',
  cen_population_yoy: 'neutral',
  cen_income_yoy: 'neutral',
  cen_homeownership_rate: 'neutral',
  cen_rent_as_pct_of_income: 'neutral',

  // Economic metrics — neutral
  econ_gdp_yoy: 'neutral',

  // Zillow inventory — neutral
  z_inventory: 'neutral',

  // Calculated affordability — neutral (slow-moving ratio)
  calc_income_to_buy: 'neutral',

  // FRED macro — skip (national scalar; fred_macro table may not exist)
  fred_vix: 'skip',

  // Realtor listing metrics — skip (market activity; biased if absent)
  price_reduced_share: 'skip',
  pending_listing_count_yy: 'skip',
};

// Metrics that are required for each component
// If any required metric is missing, the entire component is skipped
export const REQUIRED_METRICS_BY_COMPONENT: Record<string, string[]> = {
  // HomeReady
  affordability: [],
  market_timing: [],
  stability: [],
  growth_potential: [],

  // InvestorEdge
  cash_flow: [],
  rent_demand: [],
  appreciation: [],
  entry_point: [],
  risk: [],

  // Market Health
  demand_strength: [],
  supply_balance: [],
};
