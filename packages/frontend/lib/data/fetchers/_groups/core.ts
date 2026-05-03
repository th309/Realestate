/**
 * CORE FETCHERS
 *
 * Base HTTP utilities, snapshot/time-series/trend data, geojson, freshness.
 * The primitives every other fetcher group builds on.
 */

// Base utilities
export { API_URL, fetchAPI, fetchAPIWithParams, fetchAPIRaw } from "../base";

// Auth headers
export { getAuthHeaders } from "../auth-headers";

// Snapshot data (current values)
export { fetchSnapshotData, fetchMetricData, toHomeValues } from "../snapshot";

// Time series data (historical values)
export {
  fetchTimeSeriesData,
  fetchAvailableDates,
  timeSeriesApi,
} from "../timeseries";

// Trend data (change calculations)
export {
  fetchTrendData,
  fetchTrendDataBatch,
  normalizeSparklineData,
  fetchBatchTrendsServer,
  type BatchTrendEntry,
} from "../trend";

// GeoJSON
export { getGeoJsonApiUrl } from "../geojson";

// Data freshness (canonical "as of" dates for UI)
export { fetchDataFreshness, type DataFreshnessResponse } from "../freshness";
