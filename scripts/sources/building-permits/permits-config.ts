/**
 * Configuration for Census Bureau Building Permits Survey (BPS) imports.
 *
 * Defines BPS API endpoints, database table schemas, conflict keys,
 * year range defaults, and the raw CSV column layout used when parsing
 * monthly county-level permit files from Census.
 *
 * Data source: https://www2.census.gov/econ/bps/
 */

// ---------------------------------------------------------------------------
// Census BPS base URL and rate limiting
// ---------------------------------------------------------------------------

export const BPS_BASE_URL = 'https://www2.census.gov/econ/bps';

/** Delay between HTTP requests to Census servers (milliseconds). */
export const RATE_LIMIT_DELAY_MS = 300;

// ---------------------------------------------------------------------------
// Default year range
// ---------------------------------------------------------------------------

export const DEFAULT_START_YEAR = 2015;

/** End year defaults to the current calendar year. */
export function getDefaultEndYear(): number {
  return new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// CSV column definitions for raw BPS county files
// ---------------------------------------------------------------------------

/**
 * Column names in the raw Census BPS county CSV files.
 * The first 17 are data columns; the remaining 12 are "reported" duplicates
 * that we parse but ignore during record mapping.
 */
export const BPS_COUNTY_CSV_COLUMNS = [
  'survey_date', 'state_fips', 'county_fips', 'region_code', 'division_code', 'county_name',
  'sf_buildings', 'sf_units', 'sf_value',
  'duplex_buildings', 'duplex_units', 'duplex_value',
  'small_multi_buildings', 'small_multi_units', 'small_multi_value',
  'large_multi_buildings', 'large_multi_units', 'large_multi_value',
  // "Reported" columns (not used, but must be listed for csv-parse)
  'sf_buildings_rep', 'sf_units_rep', 'sf_value_rep',
  'duplex_buildings_rep', 'duplex_units_rep', 'duplex_value_rep',
  'small_multi_buildings_rep', 'small_multi_units_rep', 'small_multi_value_rep',
  'large_multi_buildings_rep', 'large_multi_units_rep', 'large_multi_value_rep',
] as const;

// ---------------------------------------------------------------------------
// Database table definitions per geography
// ---------------------------------------------------------------------------

export interface PermitsTableConfig {
  tableName: string;
  conflictKeys: string[];
}

export const PERMITS_TABLES: Record<string, PermitsTableConfig> = {
  county: {
    tableName: 'permits_county',
    conflictKeys: ['period_date', 'fips_code'],
  },
  state: {
    tableName: 'permits_state',
    conflictKeys: ['period_date', 'state_fips'],
  },
};

// ---------------------------------------------------------------------------
// Permit field names used for aggregation and YoY calculation
// ---------------------------------------------------------------------------

/** Numeric fields that appear in every permit record (county and state). */
export const PERMIT_NUMERIC_FIELDS = [
  'sf_buildings', 'sf_units', 'sf_value',
  'duplex_buildings', 'duplex_units', 'duplex_value',
  'small_multi_buildings', 'small_multi_units', 'small_multi_value',
  'large_multi_buildings', 'large_multi_units', 'large_multi_value',
  'total_buildings', 'total_units', 'total_value',
] as const;

/**
 * Fields on which we compute year-over-year percentage change.
 * Each entry maps field name -> yoy field name.
 */
export const YOY_FIELDS: Record<string, string> = {
  sf_units: 'sf_units_yoy',
  total_units: 'total_units_yoy',
};

// ---------------------------------------------------------------------------
// Record types for county and state permit data
// ---------------------------------------------------------------------------

/** Shared permit metric fields present on both county and state records. */
export interface PermitMetricFields {
  /** Index signature for Record<string, unknown> compatibility with batchUpsert. */
  [key: string]: string | number | null;
  sf_buildings: number | null;
  sf_units: number | null;
  sf_value: number | null;
  duplex_buildings: number | null;
  duplex_units: number | null;
  duplex_value: number | null;
  small_multi_buildings: number | null;
  small_multi_units: number | null;
  small_multi_value: number | null;
  large_multi_buildings: number | null;
  large_multi_units: number | null;
  large_multi_value: number | null;
  total_buildings: number | null;
  total_units: number | null;
  total_value: number | null;
  sf_units_yoy: number | null;
  total_units_yoy: number | null;
  updated_at: string;
}

/** A parsed county-level permit record ready for DB upsert. */
export interface PermitCountyRecord extends PermitMetricFields {
  period_date: string;
  fips_code: string;
  county_name: string;
  state_fips: string;
  region_code: string;
  division_code: string;
}

/** A parsed state-level permit record ready for DB upsert. */
export interface PermitStateRecord extends PermitMetricFields {
  period_date: string;
  state_fips: string;
  state_name: null;
}
