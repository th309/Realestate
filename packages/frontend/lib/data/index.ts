/**
 * UNIFIED DATA LAYER
 *
 * Central entry point for all data layer functionality.
 * Import from '@/lib/data' to access types, registry, helpers, and fetchers.
 */

// ============================================================================
// TYPES
// ============================================================================
export type {
  // Geography
  GeoLevel,

  // Metric configuration
  MetricFormat,
  DataSource,
  MetricConfig,

  // Snapshot data
  SnapshotEntry,
  SnapshotData,
  SnapshotFetchOptions,

  // Time series data
  TimeSeriesPoint,
  TimeSeriesResult,
  TimeSeriesHistoryResult,
  TimeSeriesFetchOptions,
  DateRangeResponse,

  // Trend data
  TrendDirection,
  TrendResult,

  // Score data
  ScoreType,
  ConfidenceLevel,
  SingleScoreResult,
  ScoreResponse,
  BatchScoreResponse,

  // API types
  ApiResponse,
  ApiResponseItem,

  // Legacy aliases
  MetricDataEntry,
  MetricData,
  HomeValueEntry,
  HomeValues,
  MapDataEntry,
  MapData,
  TimeSeriesDataPoint,
  TimeSeriesResponse,
} from './types';

// ============================================================================
// REGISTRY
// ============================================================================
export {
  // Constants
  METRICS,
  DATA_DATES,
  METRO_ONLY_METRICS,
  GEO_ZOOM_LEVELS,
  GEOJSON_SOURCES,

  // Functions
  metricHasTimeSeries,
  isScoreMetric,
} from './registry';

// ============================================================================
// REGISTRY HELPERS
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
  getAllMetricIds,
  getMetricsByDataSource,
  getMetricsForGeoLevel,
} from './registry-helpers';

// ============================================================================
// FORMATTING
// ============================================================================
export {
  formatMetricValue,
  formatPercentChange,
  getTrendDirection,
} from './format';

// ============================================================================
// FETCHERS
// ============================================================================
export {
  // Base
  API_URL,
  fetchAPI,
  fetchAPIWithParams,

  // Snapshot
  fetchSnapshotData,
  fetchMetricData,
  toHomeValues,

  // Time series
  fetchTimeSeriesData,
  fetchAvailableDates,
  timeSeriesApi,

  // Trend
  fetchTrendData,
  fetchTrendDataBatch,
  normalizeSparklineData,

  // Scores
  fetchScore,
  fetchBatchScores,
  fetchScoreExpanded,

  // Markets
  fetchMarketStats,
  type MarketStats,
} from './fetchers';

// ============================================================================
// HOOKS
// ============================================================================
export {
  // Snapshot
  useSnapshotData,
  useSnapshotDataBatch,
  type UseSnapshotDataOptions,
  type UseSnapshotDataResult,

  // Time series
  useTimeSeriesData,
  useAvailableDates,
  type UseTimeSeriesDataOptions,
  type UseTimeSeriesDataResult,

  // Trend
  useTrendData,
  useTrendDataBatch,
  useMarketFactorsTrends,
  type UseTrendDataOptions,
  type UseTrendDataResult,

  // Data card
  useDataCard,
  useDataCardBatch,
  type UseDataCardOptions,
  type UseDataCardResult,

  // Scores
  useScoreData,
  useSingleScore,
  type UseScoreDataOptions,
  type UseScoreDataResult,
} from './hooks';
