/**
 * Fallback Registry — THE single source of truth for metric fallback chains.
 *
 * Every metric in the system has exactly ONE entry here defining:
 * 1. Which data sources to try, in order
 * 2. Whether to inherit from parent geographies
 *
 * When adding a new metric or data source, add it HERE and nowhere else.
 * Consumers call MetricResolutionService which reads from this registry.
 *
 * Extracted from:
 * - market-snapshot.service.ts (REALTOR_COLUMN_MAP, ZILLOW_METRIC_MAP, etc.)
 * - reports-data-fetcher.ts (ZHVI->Realtor, ZORI->Census fallbacks)
 * - scoring-data-fetcher.ts (ZIP median_price->Census, demand/hotness->county)
 * - inheritance.service.ts (geographic inheritance chain)
 */

import { MetricFallbackChain, FallbackSource } from './metric-resolution.types';

// Helpers for common transforms
const toPercent = (v: number) => v * 100;

// ============================================================================
// FALLBACK REGISTRY
// ============================================================================

export const FALLBACK_REGISTRY: Record<string, MetricFallbackChain> = {
  // --------------------------------------------------------------------------
  // Price Metrics
  // --------------------------------------------------------------------------
  home_value: {
    metricId: 'home_value',
    sources: [
      { source: 'zillow', column: 'zhvi' },
      { source: 'census', column: 'median_home_value' },
      { source: 'realtor', column: 'median_listing_price' },
    ],
    supportsGeoInheritance: false,
  },

  listing_price: {
    metricId: 'listing_price',
    sources: [
      { source: 'realtor', column: 'median_listing_price' },
    ],
    supportsGeoInheritance: false,
  },

  home_value_yoy: {
    metricId: 'home_value_yoy',
    sources: [
      { source: 'realtor', column: 'median_listing_price_yy', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  home_value_mom: {
    metricId: 'home_value_mom',
    sources: [
      { source: 'realtor', column: 'median_listing_price_mm', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  home_price_forecast: {
    metricId: 'home_price_forecast',
    sources: [
      { source: 'zillow', column: 'zhvf_12m' },
    ],
    supportsGeoInheritance: false,
  },

  home_value_5yr: {
    metricId: 'home_value_5yr',
    sources: [
      { source: 'calculated', column: 'home_value_5yr_cagr' },
    ],
    supportsGeoInheritance: false,
  },

  price_per_sqft: {
    metricId: 'price_per_sqft',
    sources: [
      { source: 'realtor', column: 'median_listing_price_per_square_foot' },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Rent Metrics
  // --------------------------------------------------------------------------
  rent_index: {
    metricId: 'rent_index',
    sources: [
      { source: 'zillow', column: 'zori' },
      { source: 'hud_fmr', column: 'fmr_2br', geoLevels: ['zip'] },
      { source: 'census', column: 'median_gross_rent' },
    ],
    supportsGeoInheritance: false,
  },

  rent_for_houses: {
    metricId: 'rent_for_houses',
    sources: [
      { source: 'zillow', column: 'zordi_sfr' },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Sales / Activity Metrics
  // --------------------------------------------------------------------------
  home_sales: {
    metricId: 'home_sales',
    sources: [
      { source: 'zillow', column: 'sales_count' },
      { source: 'realtor', column: 'pending_listing_count' },
    ],
    supportsGeoInheritance: false,
  },

  home_sales_yoy: {
    metricId: 'home_sales_yoy',
    sources: [
      { source: 'realtor', column: 'pending_listing_count_yy', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  sale_to_list: {
    metricId: 'sale_to_list',
    sources: [
      { source: 'zillow', column: 'sale_to_list', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Market Heat / Demand / Supply
  // --------------------------------------------------------------------------
  market_heat: {
    metricId: 'market_heat',
    sources: [
      { source: 'zillow', column: 'market_heat_index' },
    ],
    supportsGeoInheritance: false,
  },

  hotness_score: {
    metricId: 'hotness_score',
    sources: [
      { source: 'realtor', column: 'hotness_score' },
    ],
    supportsGeoInheritance: true,
  },

  demand_score: {
    metricId: 'demand_score',
    sources: [
      { source: 'realtor', column: 'demand_score' },
    ],
    supportsGeoInheritance: true,
  },

  supply_score: {
    metricId: 'supply_score',
    sources: [
      { source: 'realtor', column: 'supply_score' },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Inventory / Listing Activity
  // --------------------------------------------------------------------------
  for_sale_inventory: {
    metricId: 'for_sale_inventory',
    sources: [
      { source: 'realtor', column: 'active_listing_count' },
    ],
    supportsGeoInheritance: false,
  },

  inventory_yoy: {
    metricId: 'inventory_yoy',
    sources: [
      { source: 'realtor', column: 'active_listing_count_yy', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  days_on_market: {
    metricId: 'days_on_market',
    sources: [
      { source: 'realtor', column: 'median_days_on_market' },
    ],
    supportsGeoInheritance: false,
  },

  new_listings: {
    metricId: 'new_listings',
    sources: [
      { source: 'realtor', column: 'new_listing_count' },
    ],
    supportsGeoInheritance: false,
  },

  new_listings_yoy: {
    metricId: 'new_listings_yoy',
    sources: [
      { source: 'realtor', column: 'new_listing_count_yy', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  pending_listings: {
    metricId: 'pending_listings',
    sources: [
      { source: 'realtor', column: 'pending_listing_count' },
    ],
    supportsGeoInheritance: false,
  },

  pending_ratio: {
    metricId: 'pending_ratio',
    sources: [
      { source: 'realtor', column: 'pending_ratio' },
    ],
    supportsGeoInheritance: false,
  },

  price_cut_pct: {
    metricId: 'price_cut_pct',
    sources: [
      { source: 'realtor', column: 'price_reduced_share', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  price_increase_pct: {
    metricId: 'price_increase_pct',
    sources: [
      { source: 'realtor', column: 'price_increased_share', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // New Construction
  // --------------------------------------------------------------------------
  new_construction_sales: {
    metricId: 'new_construction_sales',
    sources: [
      { source: 'zillow', column: 'new_con_sales' },
    ],
    supportsGeoInheritance: false,
  },

  new_construction_price: {
    metricId: 'new_construction_price',
    sources: [
      { source: 'zillow', column: 'new_con_median_price' },
    ],
    supportsGeoInheritance: false,
  },

  new_construction_ppsf: {
    metricId: 'new_construction_ppsf',
    sources: [
      { source: 'zillow', column: 'new_con_median_price_per_sqft' },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Affordability (Zillow, metro only)
  // --------------------------------------------------------------------------
  years_to_save: {
    metricId: 'years_to_save',
    sources: [
      { source: 'zillow', column: 'years_to_save', geoLevels: ['metro'] },
      { source: 'calculated', column: 'years_to_save' },
    ],
    supportsGeoInheritance: false,
  },

  income_to_rent: {
    metricId: 'income_to_rent',
    sources: [
      { source: 'zillow', column: 'renter_income', geoLevels: ['metro'] },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Census / Demographics
  // --------------------------------------------------------------------------
  population: {
    metricId: 'population',
    sources: [
      { source: 'census', column: 'total_population' },
    ],
    supportsGeoInheritance: false,
  },

  median_income: {
    metricId: 'median_income',
    sources: [
      { source: 'census', column: 'median_household_income' },
    ],
    supportsGeoInheritance: false,
  },

  median_age: {
    metricId: 'median_age',
    sources: [
      { source: 'census', column: 'median_age' },
    ],
    supportsGeoInheritance: false,
  },

  homeownership_rate: {
    metricId: 'homeownership_rate',
    sources: [
      { source: 'census', column: 'homeownership_rate' },
    ],
    supportsGeoInheritance: false,
  },

  population_growth: {
    metricId: 'population_growth',
    sources: [
      { source: 'census', column: 'population_yoy' },
    ],
    supportsGeoInheritance: true,
  },

  income_growth: {
    metricId: 'income_growth',
    sources: [
      { source: 'census', column: 'income_yoy' },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Economic Indicators
  // --------------------------------------------------------------------------
  unemployment_rate: {
    metricId: 'unemployment_rate',
    sources: [
      { source: 'economic', column: 'unemployment_rate' },
    ],
    supportsGeoInheritance: true,
  },

  job_growth: {
    metricId: 'job_growth',
    sources: [
      { source: 'economic', column: 'employment_yoy' },
    ],
    supportsGeoInheritance: true,
  },

  gdp_growth: {
    metricId: 'gdp_growth',
    sources: [
      { source: 'economic', column: 'gdp_yoy' },
    ],
    supportsGeoInheritance: true,
  },

  cost_of_living: {
    metricId: 'cost_of_living',
    sources: [
      { source: 'economic', column: 'rpp_all_items' },
    ],
    supportsGeoInheritance: true,
  },

  // --------------------------------------------------------------------------
  // Calculated / Investment Metrics
  // --------------------------------------------------------------------------
  cap_rate: {
    metricId: 'cap_rate',
    sources: [
      { source: 'calculated', column: 'cap_rate' },
    ],
    supportsGeoInheritance: false,
  },

  gross_yield: {
    metricId: 'gross_yield',
    sources: [
      { source: 'calculated', column: 'gross_yield' },
    ],
    supportsGeoInheritance: false,
  },

  rent_to_price_ratio: {
    metricId: 'rent_to_price_ratio',
    sources: [
      { source: 'calculated', column: 'rent_to_price_ratio', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },

  grm: {
    metricId: 'grm',
    sources: [
      { source: 'calculated', column: 'grm' },
    ],
    supportsGeoInheritance: false,
  },

  overvalued_pct: {
    metricId: 'overvalued_pct',
    sources: [
      { source: 'calculated', column: 'overvalued_pct' },
    ],
    supportsGeoInheritance: false,
  },

  inventory_surplus: {
    metricId: 'inventory_surplus',
    sources: [
      { source: 'calculated', column: 'inventory_surplus_pct' },
    ],
    supportsGeoInheritance: false,
  },

  income_to_buy: {
    metricId: 'income_to_buy',
    sources: [
      { source: 'calculated', column: 'income_to_buy' },
    ],
    supportsGeoInheritance: false,
  },

  affordable_home_price: {
    metricId: 'affordable_home_price',
    sources: [
      { source: 'calculated', column: 'affordable_home_price' },
    ],
    supportsGeoInheritance: false,
  },

  // --------------------------------------------------------------------------
  // Permits (county only)
  // --------------------------------------------------------------------------
  sf_permits: {
    metricId: 'sf_permits',
    sources: [
      { source: 'permits', column: 'sf_units', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: false,
  },

  mf_permits: {
    metricId: 'mf_permits',
    sources: [
      { source: 'permits', column: 'large_multi_units', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: false,
  },

  total_permits: {
    metricId: 'total_permits',
    sources: [
      { source: 'permits', column: 'total_units', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: false,
  },

  permits_yoy: {
    metricId: 'permits_yoy',
    sources: [
      { source: 'permits', column: 'total_units_yoy', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: true,
  },
};

/**
 * Get a fallback chain for a metric, or null if not registered.
 */
export function getFallbackChain(metricId: string): MetricFallbackChain | null {
  return FALLBACK_REGISTRY[metricId] ?? null;
}

/**
 * Get all registered metric IDs.
 */
export function getAllRegisteredMetricIds(): string[] {
  return Object.keys(FALLBACK_REGISTRY);
}
