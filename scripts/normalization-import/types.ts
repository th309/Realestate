/**
 * Types for Normalization CSV Import
 */

export interface ImportResult {
  file: string;
  rowsProcessed: number;
  rowsInserted: number;
  errors: string[];
  skipped: number;
}

export interface StateRecord {
  geoid: string;
  name: string;
  state_abbreviation: string;
  population: number | null;
  name_fragment: string;
}

export interface CountyRecord {
  geoid: string;
  name: string;
  state_fips: string;
  population: number | null;
  county_name_fragment: string;
  pct_of_state_population: number | null;
}

export interface CBSARecord {
  geoid: string;
  name: string;
  lsad: string | null;
  population: number | null;
}

export interface ZIPRecord {
  geoid: string;
  population: number | null;
  default_city: string;
  default_state: string;
  cbsa_code: string | null;
}

export interface ZIPCountyRelation {
  zip_geoid: string;
  county_geoid: string;
  overlap_percentage: number | null;
  is_primary: boolean;
}

export interface ZIPCBSARelation {
  zip_geoid: string;
  cbsa_geoid: string;
  overlap_percentage: number | null;
  is_primary: boolean;
}
