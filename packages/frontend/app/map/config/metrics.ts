/**
 * CENTRAL METRIC CONFIGURATION
 *
 * Re-exports from the unified data layer at @/lib/data.
 * This file maintains backward compatibility for existing imports.
 *
 * @deprecated Import directly from '@/lib/data' for new code.
 */

// ============================================================================
// TYPES
// ============================================================================
export type {
  GeoLevel,
  MetricFormat,
  DataSource,
  MetricConfig,
} from '@/lib/data';

// ============================================================================
// REGISTRY CONSTANTS
// ============================================================================
export {
  METRICS,
  DATA_DATES,
  METRO_ONLY_METRICS,
  GEO_ZOOM_LEVELS,
  GEOJSON_SOURCES,
} from '@/lib/data';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
export {
  getMetricConfig,
  getKeyFieldForGeo,
  getGeoPathSegment,
  isMetricSupportedForGeo,
  getMetricFormat,
  getMetricTitle,
  getMetricDataDate,
  formatDataDateForDisplay,
  getDefaultZoom,
} from '@/lib/data';
