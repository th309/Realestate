/**
 * Zillow Service Types
 */

export interface HomeValueData {
  region_id: string;
  region_name: string;
  state_abbrev?: string | null;
  state_name?: string | null;
  county_fips?: string | null;
  cbsa_code?: string | null;
  zip_code?: string | null;
  city?: string | null;
  county_name?: string | null;
  value: number;
  date: string;
  property_type: string;
  geography: string;
}

export interface ForecastData {
  region_id: string;
  region_name: string;
  cbsa_code?: string | null;
  zip_code?: string | null;
  state_abbrev?: string | null;
  forecast_1m: number | null;
  forecast_3m: number | null;
  forecast_12m: number | null;
  value: number;
  date: string;
  geography: string;
}

export interface StateMapping {
  abbrev: string;
  name: string;
}

export interface MetroMapping {
  cbsa_code: string;
  cbsa_name: string;
  state: string | null;
}

export interface CountyMapping {
  fips: string;
  name: string;
  state_abbrev: string;
  state_name: string;
}

export interface ZipMapping {
  city: string;
  county: string;
  state_abbrev: string;
  state_name: string;
}

export type ForecastHorizon = '1m' | '3m' | '12m';
export type PropertyType = 'all' | 'sfr' | 'mfr';

// Market Indicator Types
export interface MarketIndicatorData {
  region_id: string;
  region_name: string;
  cbsa_code?: string | null;
  state_abbrev?: string | null;
  value: number;
  date: string;
  property_type?: string;
  geography: string;
  // Additional fields for specific metrics
  mean_price?: number;
  price_per_sqft?: number;
}

export interface AffordabilityData {
  region_id: string;
  region_name: string;
  cbsa_code?: string | null;
  state_abbrev?: string | null;
  date: string;
  geography: string;
  homeowner_income_needed: number | null;
  renter_income_needed: number | null;
  affordable_home_price: number | null;
  years_to_save: number | null;
  homeowner_affordability_percent: number | null;
  renter_affordability_percent: number | null;
  down_payment_percent: number | null;
  property_type?: string;
}

export interface PriceCutsData {
  region_id: string;
  region_name: string;
  cbsa_code?: string | null;
  state_abbrev?: string | null;
  date: string;
  geography: string;
  share_with_price_cut: number | null;
  median_price_cut_amount: number | null;
  median_price_cut_percent: number | null;
}

export interface NewConstructionData {
  region_id: string;
  region_name: string;
  cbsa_code?: string | null;
  state_abbrev?: string | null;
  date: string;
  geography: string;
  sales_count: number | null;
  median_sale_price: number | null;
  price_per_sqft: number | null;
}

// Metric names for market indicators
export type MarketIndicatorMetric =
  | 'inventory'
  | 'new_listings'
  | 'pending_sales'
  | 'list_price'
  | 'sale_price'
  | 'sale_to_list'
  | 'dom'
  | 'price_cuts'
  | 'market_heat';
