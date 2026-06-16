/**
 * METRIC REGISTRY
 *
 * Single source of truth for ALL metric definitions.
 * Add a new metric here and it automatically works everywhere:
 * - Map display, Legend, Tooltips, Data fetching, Color scales
 * - Time series graphs, Trend calculations, Score cards
 *
 * The metric definitions themselves live under `./metrics/` (grouped by category)
 * and are composed here. Spread order preserves the original key insertion order.
 */

import type { GeoLevel, MetricConfig, DataSource } from "./types";
import { HOME_RENT_METRICS } from "./metrics/home-rent";
import { MARKET_ACTIVITY_METRICS } from "./metrics/market-activity";
import { AFFORDABILITY_METRICS } from "./metrics/affordability";
import { LISTING_SCORES_METRICS } from "./metrics/listing-scores";
import { INVESTOR_METRICS } from "./metrics/investor";
import { CONSTRUCTION_METRICS } from "./metrics/construction";
import { DEMOGRAPHICS_METRICS } from "./metrics/demographics";
import { EMPLOYMENT_METRICS } from "./metrics/employment";
import { MIGRATION_METRICS } from "./metrics/migration";

// ============================================================================
// MAP DISPLAY SETTINGS
// ============================================================================

/**
 * Default zoom levels by geography type
 */
export const GEO_ZOOM_LEVELS: Record<GeoLevel, number> = {
  national: 4,
  state: 4,
  metro: 4,
  county: 4,
  city: 4,
  zip: 4,
  tract: 6,
};

/**
 * GeoJSON source endpoints for each geography level
 */
export const GEOJSON_SOURCES: Record<string, string> = {
  national: "/api/geography/national",
  state: "/api/geography/states",
  county: "/api/geography/counties",
  metro: "/api/geography/metros",
  city: "/api/geography/cities",
  zip: "/api/geography/zips",
};

// ============================================================================
// DATA DATES CONFIGURATION
// ============================================================================

/**
 * Central configuration for "as of" dates by data source.
 * Update these when new data is imported.
 */
export const DATA_DATES: Record<DataSource, string> = {
  zillow: "2025-11-30",
  realtor: "2025-12-01",
  redfin: "2025-12-01",
  census: "2024",
  calculated: "2025-12-01",
  fred: "2025-09-01",
  propertyiq: "2025-12-01",
  bls: "2025-12-01",
  irs: "2023",
  redfin_migration: "2025-12-01",
};

// ============================================================================
// DATA SOURCE → PAGE ANCHOR MAPPING
// ============================================================================

/**
 * Maps DataSource values to anchor IDs on the /data page.
 * Used by the /data page to link metrics back to their provider cards.
 */
export const DATA_SOURCE_ANCHORS: Record<DataSource, string> = {
  zillow: "zillow",
  realtor: "realtor-com",
  redfin: "redfin",
  census: "census",
  calculated: "propertyiq",
  fred: "fred",
  propertyiq: "propertyiq",
  bls: "bls",
  irs: "irs",
  redfin_migration: "redfin",
};

// ============================================================================
// METRO-ONLY METRICS
// ============================================================================

/**
 * Metrics that only have data at the METRO level
 */
export const METRO_ONLY_METRICS = new Set([
  "rent_for_houses",
  "income_to_rent",
  "homeowner_affordability",
  "renter_affordability",
  "new_construction_sales",
  "new_construction_ppsf",
  "sale_price",
  "market_health",
  "market_heat",
  "overvalued_pct",
]);

// ============================================================================
// METRIC DEFINITIONS
// ============================================================================

/**
 * ALL METRIC DEFINITIONS
 *
 * Composed from the per-category modules under `./metrics/`. To add a new metric:
 * 1. Add it to the relevant `./metrics/<category>.ts` file
 * 2. Ensure the backend has the endpoint
 * 3. That's it - everything else is automatic
 *
 * Spread order matches the original category order so METRICS key order is preserved.
 */
export const METRICS: Record<string, MetricConfig> = {
  ...HOME_RENT_METRICS,
  ...MARKET_ACTIVITY_METRICS,
  ...AFFORDABILITY_METRICS,
  ...LISTING_SCORES_METRICS,
  ...INVESTOR_METRICS,
  ...CONSTRUCTION_METRICS,
  ...DEMOGRAPHICS_METRICS,
  ...EMPLOYMENT_METRICS,
  ...MIGRATION_METRICS,
};

/**
 * Check if a metric has time series data available.
 * Defaults true for zillow/realtor/census/fred/calculated, false for propertyiq (scores).
 */
export function metricHasTimeSeries(metricId: string): boolean {
  const config = METRICS[metricId];
  if (!config) return false;

  // Explicit setting takes precedence
  if (config.hasTimeSeries !== undefined) {
    return config.hasTimeSeries;
  }

  // Default based on data source
  switch (config.dataSource) {
    case "zillow":
    case "realtor":
    case "redfin":
    case "census":
    case "fred":
    case "calculated":
      return true;
    case "propertyiq":
      return false;
    default:
      return false;
  }
}

/**
 * Check if a metric is a PropertyIQ score metric.
 * These require special handling (score API instead of time series).
 */
export function isScoreMetric(metricId: string): boolean {
  return metricId === "propertyiq_score";
}
