/**
 * GEOGRAPHY TYPES
 */

/**
 * Geography levels supported by the platform.
 * Used consistently across all data fetching and display.
 */
export type GeoLevel =
  | "national"
  | "state"
  | "metro"
  | "county"
  | "city"
  | "zip"
  | "tract";
