/**
 * METRIC CONFIGURATION TYPES
 */

import type { GeoLevel } from "./geography";

/**
 * Display format types for metric values
 */
export type MetricFormat =
  | "currency"
  | "percent"
  | "percent_abs"
  | "number"
  | "index"
  | "index_1dec"
  | "days";

/**
 * Data source types - identifies which backend system provides the data
 */
export type DataSource =
  | "zillow"
  | "realtor"
  | "redfin"
  | "calculated"
  | "census"
  | "fred"
  | "propertyiq"
  | "bls"
  | "irs"
  | "redfin_migration";

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
  keyField:
    | "auto"
    | "region_id"
    | "region_name"
    | "cbsa_code"
    | "county_fips"
    | "postal_code";

  /** Which geographies support this metric */
  supportedGeos: GeoLevel[];

  /** If true, multiply value by 100 (for decimal percentages like 0.05 -> 5%) */
  asPercent?: boolean;

  /** Optional: field name in response if different from 'value' */
  valueField?: string;

  /** Range calculation: 'dynamic' uses actual data range, 'full' uses 0-100% of data */
  rangeType?: "dynamic" | "full";

  /** Fixed scale bounds for color/legend (e.g. permit counts: 0 to 200+) */
  scaleMin?: number;
  scaleMax?: number;

  /** When set, fixed scale is only used for these geo levels */
  scaleForGeos?: GeoLevel[];

  /** When true, include API rows with null value in map data */
  includeNullValues?: boolean;

  /** Whether this metric has time series data available (defaults based on dataSource) */
  hasTimeSeries?: boolean;

  /** Direction in which a higher value is favorable from a real estate investing perspective */
  favorableDirection: "higher" | "lower" | "neutral";

  /**
   * Optional short note explaining source coverage gaps. Shown in the map legend
   * beside the "No data available" swatch so users understand greyed-out regions
   * reflect the source (e.g. Realtor only ranks higher-volume markets), not a bug.
   */
  coverageNote?: string;
}
