/**
 * Map Config Barrel Exports
 */

export { NAV_ITEMS } from './nav-items';
export { METRIC_CATEGORIES, getMetricCategories } from './metric-categories';

// Central metric configuration - single source of truth
export {
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
