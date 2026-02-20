/**
 * Configuration for Redfin Market Tracker data imports.
 *
 * Defines S3 download URLs for each geography level, database table mappings,
 * conflict keys, and the list of metric columns extracted from TSV files.
 *
 * Redfin publishes gzipped TSV files at known S3 paths. Each row contains
 * a wide set of columns (PERIOD_BEGIN, REGION, REGION_TYPE, ..., MEDIAN_SALE_PRICE,
 * HOMES_SOLD, etc.) with optional _MOM and _YOY suffixes for change metrics.
 *
 * Data is stored in a wide format: one row per (geoid, metric_date) with
 * all metrics as separate columns in the redfin_metrics tables.
 */

// ---------------------------------------------------------------------------
// S3 download URLs
// ---------------------------------------------------------------------------

const S3_BASE = 'https://redfin-public-data.s3.us-west-2.amazonaws.com';

/** Gzipped TSV download URLs per geography level. */
export const REDFIN_S3_URLS: Record<string, string> = {
  national: `${S3_BASE}/redfin_market_tracker/us_national_market_tracker.tsv000.gz`,
  state: `${S3_BASE}/redfin_market_tracker/state_market_tracker.tsv000.gz`,
  metro: `${S3_BASE}/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz`,
  county: `${S3_BASE}/redfin_market_tracker/county_market_tracker.tsv000.gz`,
  city: `${S3_BASE}/redfin_market_tracker/city_market_tracker.tsv000.gz`,
  zip: `${S3_BASE}/redfin_market_tracker/zip_code_market_tracker.tsv000.gz`,
  neighborhood: `${S3_BASE}/redfin_market_tracker/neighborhood_market_tracker.tsv000.gz`,
};

// ---------------------------------------------------------------------------
// Database table configuration
// ---------------------------------------------------------------------------

export interface RedfinTableConfig {
  tableName: string;
  conflictKeys: string[];
}

/**
 * Target tables per year. Redfin data is partitioned by year:
 * - redfin_metrics (historical, pre-2024)
 * - redfin_metrics_2024
 * - redfin_metrics_2025
 * - redfin_metrics_2026 (when needed)
 */
export function getTableNameForYear(year: number): string {
  if (year >= 2024) return `redfin_metrics_${year}`;
  return 'redfin_metrics';
}

/** Conflict keys are the same for all redfin_metrics tables. */
export const REDFIN_CONFLICT_KEYS = ['geoid', 'metric_date'];

// ---------------------------------------------------------------------------
// TSV metadata columns (skipped during metric extraction)
// ---------------------------------------------------------------------------

/** Column headers in Redfin TSV files that contain metadata, not metric values. */
export const REDFIN_METADATA_COLUMNS = new Set([
  'PERIOD_BEGIN', 'PERIOD_END', 'PERIOD_DURATION',
  'REGION_TYPE', 'REGION_TYPE_ID', 'TABLE_ID', 'IS_SEASONALLY_ADJUSTED',
  'REGION', 'CITY', 'STATE', 'STATE_CODE',
  'PROPERTY_TYPE', 'PROPERTY_TYPE_ID',
  'PARENT_METRO_REGION', 'PARENT_METRO_REGION_METRO_CODE', 'LAST_UPDATED',
]);

// ---------------------------------------------------------------------------
// Metric column mapping: raw TSV column names -> database column names
// ---------------------------------------------------------------------------

/**
 * Maps normalized TSV metric names to redfin_metrics database column names.
 * The keys are lowercase, underscore-separated versions of the raw TSV headers
 * (e.g., MEDIAN_SALE_PRICE -> median_sale_price).
 *
 * Only metrics listed here are extracted; unlisted metrics are ignored.
 */
export const REDFIN_METRIC_TO_DB_COLUMN: Record<string, string> = {
  median_sale_price: 'median_sale_price',
  median_list_price: 'median_list_price',
  median_ppsf: 'median_ppsf',
  median_list_ppsf: 'median_ppsf',
  price_per_square_foot: 'median_ppsf',
  homes_sold: 'homes_sold',
  new_listings: 'new_listings',
  inventory: 'inventory',
  months_of_supply: 'months_of_supply',
  median_dom: 'median_days_on_market',
  median_days_on_market: 'median_days_on_market',
  avg_sale_to_list: 'average_sale_to_list',
  sale_to_list: 'average_sale_to_list',
  average_sale_to_list: 'average_sale_to_list',
  sale_to_list_ratio: 'average_sale_to_list',
  compete_score: 'compete_score',
  sold_above_list: 'bidding_war_percentage',
  bidding_war: 'bidding_war_percentage',
  price_drops: 'price_drops_percentage',
  price_drop: 'price_drops_percentage',
};

/**
 * YoY columns that get stored alongside base metrics.
 * Maps the base metric DB column to its YoY companion column.
 */
export const REDFIN_YOY_COLUMNS: Record<string, string> = {
  median_sale_price: 'median_sale_price_yoy',
  homes_sold: 'homes_sold_yoy',
};

// ---------------------------------------------------------------------------
// Geography levels available for import
// ---------------------------------------------------------------------------

/** Default geography levels to import (excludes national and neighborhood). */
export const DEFAULT_IMPORT_GEOS = ['state', 'metro', 'county', 'zip'];

/** All available geography levels. */
export const ALL_REDFIN_GEOS = ['national', 'state', 'metro', 'county', 'city', 'zip', 'neighborhood'];

// ---------------------------------------------------------------------------
// Processing limits
// ---------------------------------------------------------------------------

/** Number of parsed rows to accumulate before flushing to the database. */
export const STREAMING_CHUNK_SIZE = 2000;

/** Batch size for Supabase upserts (records per batch). */
export const UPSERT_BATCH_SIZE = 1000;
