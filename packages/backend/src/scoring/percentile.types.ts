/**
 * Percentile Service Types & Configuration
 *
 * Shared interface, metric-name mappings, and geography table routing used by
 * the percentile calculation helpers and PercentileService.
 */

import { GeographyType } from './scoring.types';

export interface PercentileStats {
  metricName: string;
  geographyType: GeographyType;
  periodDate: string;
  p10: number;
  p20: number;
  p30: number;
  p40: number;
  p50: number;
  p60: number;
  p70: number;
  p80: number;
  p90: number;
  min: number;
  max: number;
  count: number;
  mean: number;
  stddev: number;
}

// Mapping from Realtor column names to scoring component metric names
// IMPORTANT: These must match the metric names in scoring.types.ts component definitions
// Some metrics keep original Realtor names, others use scoring service internal names
export const REALTOR_TO_INTERNAL_METRIC: Record<string, string> = {
  // These metrics keep their Realtor names (used directly in component definitions)
  median_listing_price: 'median_listing_price',
  median_listing_price_yy: 'median_listing_price_yy',
  median_listing_price_mm: 'median_listing_price_mm',
  median_listing_price_per_square_foot: 'median_listing_price_per_square_foot',
  active_listing_count: 'inventory', // Component uses 'inventory'
  active_listing_count_yy: 'active_listing_count_yy', // Component uses this exact name
  median_days_on_market: 'median_days_on_market', // Component uses this exact name
  new_listing_count: 'new_listings', // Component uses 'new_listings'
  new_listing_count_yy: 'new_listing_count_yy', // Component uses this exact name
  pending_listing_count: 'pending_sales', // Component uses 'pending_sales'
  pending_listing_count_yy: 'pending_listing_count_yy', // Component uses this exact name
  pending_ratio: 'pending_ratio',
  price_reduced_share: 'price_reduced_share',
  price_increased_share: 'price_increased_share',
  hotness_score: 'hotness_score',
  hotness_rank: 'hotness_rank',
  supply_score: 'supply_score',
  demand_score: 'demand_score',
};

// Metrics available at ALL geography levels (state, metro, county, zip)
export const COMMON_METRICS = [
  // Price metrics
  'median_listing_price',
  'median_listing_price_yy',
  'median_listing_price_mm',
  'median_listing_price_per_square_foot', // correct column name
  // Inventory metrics
  'active_listing_count',
  'active_listing_count_yy',
  // Days on market
  'median_days_on_market',
  // Listing activity
  'new_listing_count',
  'new_listing_count_yy',
  'pending_listing_count',
  'pending_listing_count_yy',
  // Ratios
  'pending_ratio',
  'price_reduced_share',
  'price_increased_share',
];

// Metrics only available at metro/county/zip levels (NOT state)
export const SUB_STATE_METRICS = [
  'hotness_score',
  'hotness_rank',
  'supply_score',
  'demand_score',
];

// Get metrics for a geography type
export function getMetricsForGeography(geographyType: GeographyType): string[] {
  if (geographyType === 'state') {
    return COMMON_METRICS;
  }
  return [...COMMON_METRICS, ...SUB_STATE_METRICS];
}

// Convert Realtor column name to internal metric name
export function toInternalMetricName(realtorColumn: string): string {
  return REALTOR_TO_INTERNAL_METRIC[realtorColumn] || realtorColumn;
}

export function getTableForGeography(geographyType: GeographyType): string {
  // Use Realtor tables as primary source (wide format with metric columns)
  switch (geographyType) {
    case 'state':
      return 'realtor_state';
    case 'metro':
      return 'realtor_metro';
    case 'county':
      return 'realtor_county';
    case 'zip':
      return 'realtor_zip';
    default:
      return 'realtor_metro';
  }
}

export function getZillowTableForGeography(
  geographyType: GeographyType,
): string {
  switch (geographyType) {
    case 'state':
      return 'zillow_state';
    case 'metro':
      return 'zillow_metro';
    case 'county':
      return 'zillow_county';
    case 'zip':
      return 'zillow_zip';
    default:
      return 'zillow_metro';
  }
}

export function getZillowIdColumn(geographyType: GeographyType): string {
  switch (geographyType) {
    case 'state':
      return 'state_abbrev';
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'county_fips';
    case 'zip':
      return 'zip_code';
    default:
      return 'cbsa_code';
  }
}
