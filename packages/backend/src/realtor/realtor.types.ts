/**
 * Shared types for the Realtor data services.
 */

export interface RealtorDataPoint {
  region_id: string;
  region_name: string;
  /** null = no data for this region (renders as "no data", NOT a real 0) */
  value: number | null;
  date?: string;
  state_id?: string;
  cbsa_code?: string;
  county_fips?: string;
  postal_code?: string;
}

// Generic row data from Supabase
export interface RealtorRow {
  [key: string]: unknown;
}

// Cache entry with TTL
export interface CacheEntry<T> {
  data: T;
  expiry: number;
}
