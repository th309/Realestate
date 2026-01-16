/**
 * Map Config Barrel Exports
 */

export { NAV_ITEMS } from './nav-items';
export { METRIC_CATEGORIES, getMetricCategories } from './metric-categories';

// Shared constants
export {
  CURRENCY_SCALES,
  PERCENTILE_BOUNDS,
  DEFAULT_VALUE_RANGES,
  ANIMATION_DURATIONS,
  MAP_PADDING,
} from './constants';

// Theme colors
export {
  VIEW_MODE_COLORS,
  BENCHMARK_COLORS,
  BENCHMARK_GRADIENTS,
  getBenchmarkGradient,
  getComparisonColor,
} from './theme';

// Central metric configuration - single source of truth
export {
  // Core types
  type GeoLevel,
  // Map display settings
  GEO_ZOOM_LEVELS,
  GEOJSON_SOURCES,
  getDefaultZoom,
  // Metric configuration
  METRICS,
  getMetricConfig,
  getMetricFormat,
  getMetricTitle,
  getKeyFieldForGeo,
  getGeoPathSegment,
  isMetricSupportedForGeo,
  type MetricConfig,
  type MetricFormat,
  type DataSource,
} from './metrics';

// Unified data fetching
export {
  fetchMetricData,
  toHomeValues,
  type MetricData,
  type MetricDataEntry,
} from './fetchMetricData';
