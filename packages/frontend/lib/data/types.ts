/**
 * UNIFIED DATA LAYER TYPES
 *
 * Central type definitions for the data layer.
 * Types are organized by domain: geography, metrics, snapshots, time series, trends, scores.
 */

// ============================================================================
// GEOGRAPHY TYPES
// ============================================================================

/**
 * Geography levels supported by the platform.
 * Used consistently across all data fetching and display.
 */
export type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip' | 'tract';

// ============================================================================
// METRIC CONFIGURATION TYPES
// ============================================================================

/**
 * Display format types for metric values
 */
export type MetricFormat = 'currency' | 'percent' | 'percent_abs' | 'number' | 'index' | 'index_1dec' | 'days';

/**
 * Data source types - identifies which backend system provides the data
 */
export type DataSource = 'zillow' | 'realtor' | 'calculated' | 'census' | 'fred' | 'propertyiq';

/**
 * Metric configuration interface - defines how to fetch and display a metric
 */
export interface MetricConfig {
  id: string;
  title: string;
  format: MetricFormat;
  dataSource: DataSource;

  /** API endpoint pattern - {geo} will be replaced with 'states', 'metros', etc. */
  apiEndpoint: string;

  /** Which field to use as the key when mapping response data */
  keyField: 'auto' | 'region_id' | 'region_name' | 'cbsa_code' | 'county_fips' | 'postal_code';

  /** Which geographies support this metric */
  supportedGeos: GeoLevel[];

  /** If true, multiply value by 100 (for decimal percentages like 0.05 -> 5%) */
  asPercent?: boolean;

  /** Optional: field name in response if different from 'value' */
  valueField?: string;

  /** Range calculation: 'dynamic' uses actual data range, 'full' uses 0-100% of data */
  rangeType?: 'dynamic' | 'full';

  /** Fixed scale bounds for color/legend (e.g. permit counts: 0 to 200+) */
  scaleMin?: number;
  scaleMax?: number;

  /** When set, fixed scale is only used for these geo levels */
  scaleForGeos?: GeoLevel[];

  /** When true, include API rows with null value in map data */
  includeNullValues?: boolean;

  /** Whether this metric has time series data available (defaults based on dataSource) */
  hasTimeSeries?: boolean;
}

// ============================================================================
// SNAPSHOT DATA TYPES (Current/Latest Values)
// ============================================================================

/**
 * A single entry in snapshot data - value may be null for undefined metrics
 */
export interface SnapshotEntry {
  value: number | null;
  date?: string;
  /** Human-readable name for the region (e.g., "Chicago-Naperville-Elgin" instead of "16980") */
  name?: string;
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

// ============================================================================
// TIME SERIES DATA TYPES
// ============================================================================

/**
 * A single point in a time series
 */
export interface TimeSeriesPoint {
  date: string;
  value: number;
}

/**
 * Result from fetching time series data
 */
export interface TimeSeriesResult {
  success: boolean;
  metric: string;
  geoLevel: string;
  regionId: string;
  count: number;
  data: TimeSeriesPoint[];
  /** Present when historyMonths was requested */
  historyMonths?: number;
  current?: number | null;
  prior?: number | null;
  trend_change?: number;
  history?: TimeSeriesHistoryResult;
}

/**
 * History result with trend calculation
 */
export interface TimeSeriesHistoryResult {
  data: TimeSeriesPoint[];
  months: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

/**
 * Options for fetching time series data
 */
export interface TimeSeriesFetchOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  historyMonths?: number;
}

/**
 * Date range response for a metric/geography combination
 */
export interface DateRangeResponse {
  success: boolean;
  metric: string;
  geoLevel: string;
  minDate: string;
  maxDate: string;
  count: number;
}

// ============================================================================
// TREND DATA TYPES
// ============================================================================

/**
 * Direction of a trend
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Result from calculating trend data
 */
export interface TrendResult {
  currentValue: number | null;
  previousValue: number | null;
  percentChange: number | null;
  direction: TrendDirection;
  sparklineData: number[];
  label: string | null;
}

// ============================================================================
// SCORE DATA TYPES
// ============================================================================

/**
 * Score types available in the system
 */
export type ScoreType = 'homeready' | 'investoredge' | 'markethealth';

/**
 * Confidence level for a score
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

/**
 * Status label for a score component based on its normalized score.
 * Mirrors backend ComponentStatus from scoring.types.ts.
 */
export type ComponentStatus = 'excellent' | 'strong' | 'moderate' | 'watch' | 'concern';

/**
 * Breakdown of a single component's contribution to an overall score.
 * Each score type is composed of 3-5 components (e.g., HomeReady has
 * affordability, market_timing, stability, growth_potential).
 * Mirrors backend ScoreComponentBreakdown from scoring.types.ts.
 */
export interface ScoreComponentBreakdown {
  /** Component name (e.g., 'affordability', 'market_timing') */
  component: string;
  /** Normalized component score (0-100) */
  score: number;
  /** Weight of this component in the overall score (0-1, sums to ~1.0) */
  weight: number;
  /** Quick-read status label based on score thresholds */
  status: ComponentStatus;
  /** Individual metrics that contribute to this component */
  contributing_metrics: {
    /** Metric name as used in formula weights */
    metric: string;
    /** Standardized z-score for this metric */
    z_score: number;
    /** Whether higher values help or hurt the score */
    direction: 'positive' | 'negative';
    /** Raw metric value before standardization, null if unavailable */
    raw_value: number | null;
  }[];
}

/**
 * Result for a single score
 */
export interface SingleScoreResult {
  score: number;
  grade: string;
  confidence: number;
  confidence_level: ConfidenceLevel;
  /** Per-component breakdown when requested (pro/enterprise tiers) */
  components?: ScoreComponentBreakdown[];
}

/**
 * Full score response for a location
 */
export interface ScoreResponse {
  location_id: string;
  location_name: string;
  geography: string;
  median_price: number | null;
  score_date: string;
  scores: {
    homeready: SingleScoreResult;
    investoredge: SingleScoreResult;
    markethealth: SingleScoreResult;
  };
  /** Per-metric z-scores (available when expanded=true) */
  z_scores?: Record<string, number>;
  return_1y?: number;
  return_3y_ann?: number;
}

/**
 * Batch score response for multiple locations
 */
export interface BatchScoreResponse {
  geographyType: string;
  periodDate?: string;
  scores: (ScoreResponse | { geographyId: string; error: string })[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

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
  cbsa_code?: string;
  county_fips?: string;
  fips_code?: string;
  postal_code?: string;
  zcta?: string;
  place_fips?: string;
  state_abbrev?: string;
  [key: string]: unknown;
}

// ============================================================================
// LEGACY TYPE ALIASES (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use SnapshotEntry instead
 */
export type MetricDataEntry = SnapshotEntry;

/**
 * @deprecated Use SnapshotData instead
 */
export type MetricData = SnapshotData;

/**
 * @deprecated Use SnapshotEntry instead
 */
export type HomeValueEntry = number | SnapshotEntry;

/**
 * @deprecated Use SnapshotData instead
 */
export type HomeValues = Record<string, HomeValueEntry>;

/**
 * @deprecated Use SnapshotData instead
 */
export type MapDataEntry = number | SnapshotEntry;

/**
 * @deprecated Use SnapshotData instead
 */
export type MapData = Record<string, MapDataEntry>;

// Re-export TimeSeriesDataPoint alias for backward compatibility
export type TimeSeriesDataPoint = TimeSeriesPoint;
export type TimeSeriesResponse = TimeSeriesResult;
