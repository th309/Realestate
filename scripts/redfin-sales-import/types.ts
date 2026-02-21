/**
 * Types and constants for Redfin S3 market tracker sales import pipeline.
 * Covers all 7 geography levels (national through neighborhood) with
 * 14 core metrics plus month-over-month and year-over-year variants.
 */

/** S3 download URL configuration for each geography level */
export interface RedfinS3Dataset {
  geoLevel: RedfinGeoLevel;
  url: string;
  tableName: string;
}

export type RedfinGeoLevel = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip' | 'neighborhood';

/** Raw parsed row from the TSV file (headers are UPPERCASE in Redfin TSV) */
export interface RedfinTsvRow {
  PERIOD_BEGIN: string;
  PERIOD_END: string;
  PERIOD_DURATION: string;
  REGION_TYPE: string;
  REGION_TYPE_ID: string;
  TABLE_ID: string;
  IS_SEASONALLY_ADJUSTED: string;
  REGION: string;
  CITY: string;
  STATE: string;
  STATE_CODE: string;
  PROPERTY_TYPE: string;
  PROPERTY_TYPE_ID: string;
  // 14 core metrics + mom + yoy (UPPERCASE in TSV)
  MEDIAN_SALE_PRICE: string;
  MEDIAN_SALE_PRICE_MOM: string;
  MEDIAN_SALE_PRICE_YOY: string;
  MEDIAN_LIST_PRICE: string;
  MEDIAN_LIST_PRICE_MOM: string;
  MEDIAN_LIST_PRICE_YOY: string;
  MEDIAN_PPSF: string;
  MEDIAN_PPSF_MOM: string;
  MEDIAN_PPSF_YOY: string;
  MEDIAN_LIST_PPSF: string;
  MEDIAN_LIST_PPSF_MOM: string;
  MEDIAN_LIST_PPSF_YOY: string;
  HOMES_SOLD: string;
  HOMES_SOLD_MOM: string;
  HOMES_SOLD_YOY: string;
  PENDING_SALES: string;
  PENDING_SALES_MOM: string;
  PENDING_SALES_YOY: string;
  NEW_LISTINGS: string;
  NEW_LISTINGS_MOM: string;
  NEW_LISTINGS_YOY: string;
  INVENTORY: string;
  INVENTORY_MOM: string;
  INVENTORY_YOY: string;
  MONTHS_OF_SUPPLY: string;
  MONTHS_OF_SUPPLY_MOM: string;
  MONTHS_OF_SUPPLY_YOY: string;
  MEDIAN_DOM: string;
  MEDIAN_DOM_MOM: string;
  MEDIAN_DOM_YOY: string;
  AVG_SALE_TO_LIST: string;
  AVG_SALE_TO_LIST_MOM: string;
  AVG_SALE_TO_LIST_YOY: string;
  SOLD_ABOVE_LIST: string;
  SOLD_ABOVE_LIST_MOM: string;
  SOLD_ABOVE_LIST_YOY: string;
  PRICE_DROPS: string;
  PRICE_DROPS_MOM: string;
  PRICE_DROPS_YOY: string;
  OFF_MARKET_IN_TWO_WEEKS: string;
  OFF_MARKET_IN_TWO_WEEKS_MOM: string;
  OFF_MARKET_IN_TWO_WEEKS_YOY: string;
  PARENT_METRO_REGION: string;
  PARENT_METRO_REGION_METRO_CODE: string;
  LAST_UPDATED: string;
}

/** Database record ready for insertion */
export interface RedfinSalesRecord {
  period_begin: string;
  period_end: string;
  property_type: string;
  // Metric fields - all optional number | null
  median_sale_price?: number | null;
  median_sale_price_mom?: number | null;
  median_sale_price_yoy?: number | null;
  median_list_price?: number | null;
  median_list_price_mom?: number | null;
  median_list_price_yoy?: number | null;
  median_ppsf?: number | null;
  median_ppsf_mom?: number | null;
  median_ppsf_yoy?: number | null;
  median_list_ppsf?: number | null;
  median_list_ppsf_mom?: number | null;
  median_list_ppsf_yoy?: number | null;
  homes_sold?: number | null;
  homes_sold_mom?: number | null;
  homes_sold_yoy?: number | null;
  pending_sales?: number | null;
  pending_sales_mom?: number | null;
  pending_sales_yoy?: number | null;
  new_listings?: number | null;
  new_listings_mom?: number | null;
  new_listings_yoy?: number | null;
  inventory?: number | null;
  inventory_mom?: number | null;
  inventory_yoy?: number | null;
  months_of_supply?: number | null;
  months_of_supply_mom?: number | null;
  months_of_supply_yoy?: number | null;
  median_dom?: number | null;
  median_dom_mom?: number | null;
  median_dom_yoy?: number | null;
  avg_sale_to_list?: number | null;
  avg_sale_to_list_mom?: number | null;
  avg_sale_to_list_yoy?: number | null;
  sold_above_list?: number | null;
  sold_above_list_mom?: number | null;
  sold_above_list_yoy?: number | null;
  price_drops?: number | null;
  price_drops_mom?: number | null;
  price_drops_yoy?: number | null;
  off_market_in_two_weeks?: number | null;
  off_market_in_two_weeks_mom?: number | null;
  off_market_in_two_weeks_yoy?: number | null;
  parent_metro_region?: string | null;
  parent_metro_region_metro_code?: string | null;
  last_updated?: string | null;
  // Geo identifiers (set based on geo level)
  state_code?: string | null;
  state_name?: string | null;
  state_fips?: string | null;
  region_name?: string | null;
  cbsa_code?: string | null;
  county_name?: string | null;
  fips_code?: string | null;
  city_name?: string | null;
  place_fips?: string | null;
  zip_code?: string | null;
  neighborhood_name?: string | null;
  city?: string | null;
  redfin_table_id?: number | null;
}

export interface ImportResult {
  geoLevel: RedfinGeoLevel;
  tableName: string;
  totalRows: number;
  inserted: number;
  errors: number;
  durationMs: number;
}

export const S3_BASE = 'https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker';

export const REDFIN_S3_DATASETS: RedfinS3Dataset[] = [
  { geoLevel: 'national', url: `${S3_BASE}/us_national_market_tracker.tsv000.gz`, tableName: 'redfin_national' },
  { geoLevel: 'state', url: `${S3_BASE}/state_market_tracker.tsv000.gz`, tableName: 'redfin_state' },
  { geoLevel: 'metro', url: `${S3_BASE}/redfin_metro_market_tracker.tsv000.gz`, tableName: 'redfin_metro' },
  { geoLevel: 'county', url: `${S3_BASE}/county_market_tracker.tsv000.gz`, tableName: 'redfin_county' },
  { geoLevel: 'city', url: `${S3_BASE}/city_market_tracker.tsv000.gz`, tableName: 'redfin_city' },
  { geoLevel: 'zip', url: `${S3_BASE}/zip_code_market_tracker.tsv000.gz`, tableName: 'redfin_zip' },
  { geoLevel: 'neighborhood', url: `${S3_BASE}/neighborhood_market_tracker.tsv000.gz`, tableName: 'redfin_neighborhood' },
];

/** The 14 core metric column names (each has _mom and _yoy variants) */
export const METRIC_COLUMNS = [
  'median_sale_price', 'median_list_price', 'median_ppsf', 'median_list_ppsf',
  'homes_sold', 'pending_sales', 'new_listings', 'inventory',
  'months_of_supply', 'median_dom', 'avg_sale_to_list', 'sold_above_list',
  'price_drops', 'off_market_in_two_weeks',
] as const;
