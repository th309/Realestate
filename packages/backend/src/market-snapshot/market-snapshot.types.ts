export type GeoType = 'metro' | 'county' | 'zip' | 'state';

export interface MarketSnapshotMetric {
  value: number | null;
  date: string | null;
  source: string;
  sourceGeoId: string | null;
  sourceGeoLevel: GeoType | 'national' | null;
  isInherited: boolean;
  isFallback: boolean;
}

export interface MarketSnapshotResponse {
  success: boolean;
  geography: {
    id: string;
    name: string;
    type: string;
  };
  scores: {
    propertyiq: {
      score: number;
      grade: string;
      components?: Record<string, number>;
    } | null;
  };
  metrics: Record<string, MarketSnapshotMetric>;
  lastUpdated: string;
}

// Realtor DB column -> metric ID mapping
export const REALTOR_COLUMN_MAP: Record<string, string> = {
  median_listing_price: 'listing_price',
  median_listing_price_yy: 'home_value_yoy',
  median_listing_price_mm: 'home_value_mom',
  active_listing_count: 'for_sale_inventory',
  active_listing_count_yy: 'inventory_yoy',
  median_days_on_market: 'days_on_market',
  new_listing_count: 'new_listings',
  new_listing_count_yy: 'new_listings_yoy',
  pending_listing_count: 'pending_listings',
  price_reduced_share: 'price_cut_pct',
  median_listing_price_per_square_foot: 'price_per_sqft',
  pending_ratio: 'pending_ratio',
  hotness_score: 'hotness_score',
  supply_score: 'supply_score',
  demand_score: 'demand_score',
  price_increased_share: 'price_increase_pct',
};

// Realtor percent columns (stored as decimals, need *100)
// NOTE: price_reduced_share and price_increased_share are NOT included here
// because Realtor provides them as percentages already (e.g. 24.11 = 24.11%),
// not as decimals that need conversion.
export const REALTOR_PERCENT_COLS = new Set([
  'median_listing_price_yy',
  'median_listing_price_mm',
  'active_listing_count_yy',
  'new_listing_count_yy',
]);

// Zillow metric_name -> metric ID mapping
export const ZILLOW_METRIC_MAP: Record<string, string> = {
  zhvi: 'home_value',
  zori: 'rent_index',
  zordi_sfr: 'rent_for_houses',
  sale_to_list: 'sale_to_list',
  market_heat_index: 'market_heat',
  zhvf_12m: 'home_price_forecast',
  sales_count: 'home_sales',
  new_con_sales: 'new_construction_sales',
  new_con_median_price: 'new_construction_price',
  new_con_median_price_per_sqft: 'new_construction_ppsf',
};

// Zillow affordability metric_name -> metric ID (metro only)
export const ZILLOW_AFFORD_MAP: Record<string, string> = {
  years_to_save: 'years_to_save',
  renter_income: 'income_to_rent',
};

// Census DB column -> metric ID mapping
export const CENSUS_COLUMN_MAP: Record<string, string> = {
  total_population: 'population',
  median_household_income: 'median_income',
  median_age: 'median_age',
  homeownership_rate: 'homeownership_rate',
  population_yoy: 'population_growth',
  income_yoy: 'income_growth',
};

// Economic DB column -> metric ID mapping
export const ECONOMIC_COLUMN_MAP: Record<string, string> = {
  unemployment_rate: 'unemployment_rate',
  employment_yoy: 'job_growth',
  gdp_yoy: 'gdp_growth',
  rpp_all_items: 'cost_of_living',
};

// Calculated metrics DB column -> metric ID mapping
export const CALC_COLUMN_MAP: Record<string, string> = {
  cap_rate: 'cap_rate',
  gross_yield: 'gross_yield',
  rent_to_price_ratio: 'rent_to_price_ratio',
  grm: 'grm',
  overvalued_pct: 'overvalued_pct',
  home_value_5yr_cagr: 'home_value_5yr',
  inventory_surplus_pct: 'inventory_surplus',
  income_to_buy: 'income_to_buy',
  affordable_home_price: 'affordable_home_price',
};

// Permits DB column -> metric ID mapping (county only)
export const PERMITS_COLUMN_MAP: Record<string, string> = {
  sf_units: 'sf_permits',
  large_multi_units: 'mf_permits',
  total_units: 'total_permits',
  total_units_yoy: 'permits_yoy',
};
