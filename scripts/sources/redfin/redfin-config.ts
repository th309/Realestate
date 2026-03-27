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
 * Data is stored in per-geography tables (redfin_state, redfin_metro, etc.)
 * with all 14 core metrics plus MOM and YOY variants as wide-format columns.
 */

// ---------------------------------------------------------------------------
// S3 download URLs
// ---------------------------------------------------------------------------

const S3_BASE = "https://redfin-public-data.s3.us-west-2.amazonaws.com";

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
// Database table configuration (per-geography tables)
// ---------------------------------------------------------------------------

/** Table name for each geography level. */
export const REDFIN_TABLE_NAMES: Record<string, string> = {
  national: "redfin_national",
  state: "redfin_state",
  metro: "redfin_metro",
  county: "redfin_county",
  city: "redfin_city",
  zip: "redfin_zip",
  neighborhood: "redfin_neighborhood",
};

/** Conflict keys for upsert per table (match DB unique constraints). */
export const REDFIN_CONFLICT_KEYS: Record<string, string> = {
  redfin_national: "period_end,property_type",
  redfin_state: "period_end,state_code,property_type",
  redfin_metro: "period_end,region_name,property_type",
  redfin_county: "period_end,county_name,state_code,property_type",
  redfin_city: "period_end,city_name,state_code,property_type",
  redfin_zip: "period_end,zip_code,property_type",
  redfin_neighborhood:
    "period_end,neighborhood_name,city,state_code,property_type",
};

// ---------------------------------------------------------------------------
// TSV metadata columns (skipped during metric extraction)
// ---------------------------------------------------------------------------

/** Column headers in Redfin TSV files that contain metadata, not metric values. */
export const REDFIN_METADATA_COLUMNS = new Set([
  "PERIOD_BEGIN",
  "PERIOD_END",
  "PERIOD_DURATION",
  "REGION_TYPE",
  "REGION_TYPE_ID",
  "TABLE_ID",
  "IS_SEASONALLY_ADJUSTED",
  "REGION",
  "CITY",
  "STATE",
  "STATE_CODE",
  "PROPERTY_TYPE",
  "PROPERTY_TYPE_ID",
  "PARENT_METRO_REGION",
  "PARENT_METRO_REGION_METRO_CODE",
  "LAST_UPDATED",
]);

// ---------------------------------------------------------------------------
// Metric columns: the 14 core metrics (each has _mom and _yoy variants)
// ---------------------------------------------------------------------------

/** All 14 core metric column names (lowercase DB format). */
export const METRIC_COLUMNS = [
  "median_sale_price",
  "median_list_price",
  "median_ppsf",
  "median_list_ppsf",
  "homes_sold",
  "pending_sales",
  "new_listings",
  "inventory",
  "months_of_supply",
  "median_dom",
  "avg_sale_to_list",
  "sold_above_list",
  "price_drops",
  "off_market_in_two_weeks",
] as const;

// ---------------------------------------------------------------------------
// State FIPS lookup
// ---------------------------------------------------------------------------

export const STATE_FIPS: Record<string, string> = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
  AS: "60",
  GU: "66",
  MP: "69",
  PR: "72",
  VI: "78",
};

// ---------------------------------------------------------------------------
// Geography levels available for import
// ---------------------------------------------------------------------------

/** Default geography levels to import (excludes national and neighborhood). */
export const DEFAULT_IMPORT_GEOS = ["state", "metro", "county", "zip"];

/** All available geography levels. */
export const ALL_REDFIN_GEOS = [
  "national",
  "state",
  "metro",
  "county",
  "city",
  "zip",
  "neighborhood",
];

// ---------------------------------------------------------------------------
// Processing limits
// ---------------------------------------------------------------------------

/** Number of parsed rows to accumulate before flushing to the database. */
export const STREAMING_CHUNK_SIZE = 2000;

/** Batch size for Supabase upserts (records per batch). */
export const UPSERT_BATCH_SIZE = 1000;
