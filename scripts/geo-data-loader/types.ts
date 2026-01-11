/**
 * Geographic Data Loader Type Definitions
 */

export interface LoadResult {
  level: string;
  recordsLoaded: number;
  recordsLinked: number;
  relationshipsCreated: number;
  success: boolean;
  error?: string;
}

export interface MarketRecord {
  region_id: string;
  region_name: string;
  region_type: string;
  state_code?: string;
  state_name?: string;
  county_fips?: string;
  geoid?: string;
  geometry?: any;
  external_ids?: Record<string, string>;
  created_at?: string;
}
