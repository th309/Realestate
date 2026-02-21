/**
 * Metric Resolution Types
 *
 * Shared types for the centralized metric fallback/resolution system.
 * Used by fallback-registry, source-fetcher, geography-chain, and
 * the public MetricResolutionService.
 */

/** Geography levels supported across the platform */
export type GeoLevel = 'zip' | 'county' | 'metro' | 'state' | 'national';

/** Data sources available in the system */
export type DataSource =
  | 'zillow'
  | 'realtor'
  | 'census'
  | 'economic'
  | 'calculated'
  | 'permits'
  | 'hud_fmr';

/**
 * A single data source entry in a metric's fallback chain.
 * The registry tries these in order until one returns a non-null value.
 */
export interface FallbackSource {
  /** Which data source to query */
  source: DataSource;
  /** The DB column (or Zillow metric_name) to read */
  column: string;
  /** Optional transform applied to the raw DB value (e.g. multiply by 100 for decimals) */
  transform?: (val: number) => number;
  /** Restrict this source to specific geo levels (null = all levels) */
  geoLevels?: GeoLevel[];
}

/**
 * Defines the full fallback chain for a single metric.
 * This is the declarative config that lives in fallback-registry.ts.
 */
export interface MetricFallbackChain {
  /** Canonical metric ID (e.g. 'home_value', 'rent_index') */
  metricId: string;
  /** Ordered list of sources to try (first match wins) */
  sources: FallbackSource[];
  /** Whether to walk up the geography chain (ZIP->County->Metro->State->National) when all sources miss */
  supportsGeoInheritance: boolean;
}

/**
 * The result of resolving a metric — returned by MetricResolutionService.
 * Consumers get both the value and metadata about where it came from.
 */
export interface ResolvedMetric {
  /** The resolved numeric value, or null if no source had data */
  value: number | null;
  /** The period_date or year from the source row */
  date: string | null;
  /** Which data source provided the value (e.g. 'zillow', 'census') */
  source: string;
  /** Geography ID that provided the value (differs from request when inherited) */
  sourceGeoId: string | null;
  /** Geography level that provided the value */
  sourceGeoLevel: GeoLevel | null;
  /** Was this value inherited from a parent geography? */
  isInherited: boolean;
  /** Was this from a non-primary (fallback) source? */
  isFallback: boolean;
}

/**
 * Geography chain row from the geography_crosswalk table.
 * Used by GeographyChainService to look up parent geographies.
 */
export interface GeographyCrosswalkRow {
  zip_code: string | null;
  county_fips: string | null;
  cbsa_code: string | null;
  state_fips: string | null;
}

/**
 * A single step in the geography inheritance chain.
 * Built by GeographyChainService.buildInheritanceOrder().
 */
export interface GeoChainStep {
  id: string;
  level: GeoLevel;
}

/**
 * Table routing config used by SourceFetcherService.
 * Maps (source, geoLevel) -> table name, ID column, name column, date column.
 */
export interface TableRoute {
  table: string;
  idColumn: string;
  nameColumn?: string;
  dateColumn: string;
  /** For Zillow tables, the metric_name filter value */
  metricNameFilter?: string;
}
