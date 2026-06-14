/**
 * SNAPSHOT DATA TYPES (Current/Latest Values)
 */

/**
 * A single entry in snapshot data - value may be null for undefined metrics
 */
export interface SnapshotEntry {
  value: number | null;
  date?: string;
  /** Human-readable name for the region (e.g., "Chicago-Naperville-Elgin" instead of "16980") */
  name?: string;
  /** Resolved source/provider for this value, when backend includes provenance */
  source?: string | null;
  /** Geography ID where value was resolved (can differ when inherited) */
  sourceGeoId?: string | null;
  /** Geography level where value was resolved */
  sourceGeoLevel?: "metro" | "county" | "zip" | "state" | "national" | null;
  /** True when value came from parent geography */
  isInherited?: boolean;
  /** True when value came from non-primary source in fallback chain */
  isFallback?: boolean;
}

/**
 * Snapshot data keyed by region identifier
 */
export type SnapshotData = Record<string, SnapshotEntry>;

/**
 * Options for fetching snapshot data
 */
export interface SnapshotFetchOptions {
  state?: string;
  propertyType?: string;
  forecastHorizon?: string;
}
