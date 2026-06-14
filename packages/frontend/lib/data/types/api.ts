/**
 * API RESPONSE TYPES
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  count: number;
  data: T[];
}

/**
 * Generic API response item with flexible fields
 */
export interface ApiResponseItem {
  region_id: string;
  region_name?: string;
  value?: number;
  date?: string;
  source?: string;
  sourceGeoId?: string;
  source_geo_id?: string;
  sourceGeoLevel?: "metro" | "county" | "zip" | "state" | "national";
  source_geo_level?: "metro" | "county" | "zip" | "state" | "national";
  isInherited?: boolean;
  is_inherited?: boolean;
  isFallback?: boolean;
  is_fallback?: boolean;
  cbsa_code?: string;
  county_fips?: string;
  fips_code?: string;
  postal_code?: string;
  zcta?: string;
  place_fips?: string;
  state_abbrev?: string;
  location_id?: string;
  location_name?: string;
  zip_code?: string;
  score?: number;
  [key: string]: unknown;
}
