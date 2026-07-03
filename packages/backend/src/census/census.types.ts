export interface CensusDataPoint {
  region_id: string;
  region_name: string;
  value: number | null; // null indicates no data (vs 0 which is a valid value)
  year?: number;
  state_fips?: string;
  cbsa_code?: string;
  fips_code?: string;
  zcta?: string;
  place_fips?: string;
}

export interface CensusRow {
  [key: string]: unknown;
}

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}
