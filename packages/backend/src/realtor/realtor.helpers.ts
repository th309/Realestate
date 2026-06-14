/**
 * Pure helpers + shared constants for the Realtor data services.
 * No NestJS / Supabase dependencies — safe to unit test in isolation.
 */
import { normalizeStateToCode } from '../common/geo';
import type { RealtorDataPoint, RealtorRow } from './realtor.types';

/**
 * Safe string conversion helper that handles null/undefined.
 */
export function safeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

/**
 * Coerce a raw DB cell to a numeric metric value, PRESERVING null for missing
 * data. A missing value must stay null (not become 0) so the map renders it as
 * "no data" (grey) instead of a real low score (the bottom color). Genuine 0s
 * are kept; only null/undefined/empty/NaN become null.
 */
export function toNumericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/**
 * Convert FIPS, 2-letter code, or full state name to state abbreviation (for DB state_id).
 */
export function toStateAbbr(stateIdOrFipsOrName: string): string {
  return normalizeStateToCode(stateIdOrFipsOrName);
}

// Map frontend metric IDs to Realtor column names
export const metricColumnMap: Record<string, string> = {
  home_value: 'median_listing_price',
  home_value_yoy: 'median_listing_price_yy',
  home_value_mom: 'median_listing_price_mm',
  for_sale_inventory: 'active_listing_count',
  inventory_yoy: 'active_listing_count_yy',
  days_on_market: 'median_days_on_market',
  new_listings: 'new_listing_count',
  new_listings_yoy: 'new_listing_count_yy',
  pending_listings: 'pending_listing_count',
  price_cut_pct: 'price_reduced_share',
  price_per_sqft: 'median_listing_price_per_square_foot',
};

// Metrics that are stored as decimals and need to be converted to percentages
// These are multiplied by 100 for display (0.05 -> 5%)
export const percentMetrics = new Set([
  'home_value_yoy',
  'home_value_mom',
  'inventory_yoy',
  'new_listings_yoy',
  'price_cut_pct',
]);

/**
 * Process a metric value for benchmark display
 * - Converts decimal percentages to display percentages (0.05 -> 5)
 * - Filters out corrupt data for growth metrics
 * - Rounds non-percentage values to integers
 */
export function processMetricValue(
  metricId: string,
  rawValue: unknown,
): number | null {
  if (rawValue === null || rawValue === undefined) return null;

  let value = Number(rawValue);
  if (isNaN(value)) return null;

  // Check for corrupt data in growth metrics (values stored as decimals)
  // Values > 100 or < -100 as decimals would mean >10,000% which is corrupt
  const isGrowthMetric = metricId.endsWith('_yoy') || metricId.endsWith('_mom');
  if (isGrowthMetric && (value > 100 || value < -100)) {
    return null; // Treat as corrupt data
  }

  // Convert decimal percentages to display percentages
  if (percentMetrics.has(metricId)) {
    // Stored as decimal (0.05 = 5%), convert to percentage (5)
    value = value * 100;
    // Round to 1 decimal place for percentages
    return Math.round(value * 10) / 10;
  }

  // Round non-percentage values to integers
  return Math.round(value);
}

/**
 * Map raw Supabase rows to RealtorDataPoint[]. Shared by the state/metro/county/zip
 * data mappers — identical value handling, only the id/name columns differ.
 *
 * Preserves the original per-mapper behavior exactly:
 * - `value` uses {@link toNumericValue} (null stays null, genuine 0 stays 0)
 * - growth metrics (column ends in `_yy`/`_mm`) with |value| > 100 are zeroed as corrupt
 */
export function mapRows(
  rows: RealtorRow[],
  metric: string,
  opts: {
    idCol: string;
    nameCol: string;
    idKey: 'state_id' | 'cbsa_code' | 'county_fips' | 'postal_code';
  },
  latestDate: string | null,
): RealtorDataPoint[] {
  const isGrowthMetric = metric.endsWith('_yy') || metric.endsWith('_mm');

  return rows.map((row) => {
    let value: number | null = toNumericValue(row[metric]);

    // Filter out only clearly corrupt data (values in millions of percent).
    // Growth metrics are stored as decimals (0.05 = 5%), so ±100 (±10,000%) catches only corrupt data.
    if (isGrowthMetric && value !== null && (value > 100 || value < -100)) {
      value = 0; // Treat as corrupt data
    }

    return {
      region_id: safeString(row[opts.idCol]),
      region_name: safeString(row[opts.nameCol]),
      [opts.idKey]: safeString(row[opts.idCol]),
      value,
      date: latestDate ? String(latestDate) : undefined,
    } as RealtorDataPoint;
  });
}
