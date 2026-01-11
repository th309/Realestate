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
  state: string;
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
