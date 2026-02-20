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
  ComponentStatus,
  ScoreComponentBreakdown,
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
  DATA_SOURCE_ANCHORS,
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
  getMetricDefinition,
  getDataSourceAnchor,
  METRIC_DEFINITIONS,
  getMetricFavorableDirection,
} from './registry-helpers';

export type { MetricDefinition } from './registry-helpers';

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
  fetchAPIRaw,

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
  fetchTopMarkets,
  type TopMarketsGeo,
  type TopMarketsScoreType,
  type TopMarketEntry,

  // Markets
  fetchMarketStats,
  type MarketStats,

  // Market AI analysis
  fetchMarketAnalysis,
  type MarketAnalysisSection,
  type MarketAnalysisResult,

  // Market snapshot (batch)
  fetchMarketSnapshot,
  type MarketSnapshotMetric,
  type MarketSnapshotScoreEntry,
  type MarketSnapshotResponse,
  fetchBatchTrendsServer,
  type BatchTrendEntry,

  // Reports
  fetchReport,
  fetchReportHistory,
  fetchReportList,
  generateReport,
  regenerateNarratives,
  type GenerateReportRequest,
  type GenerateReportResponse,

  // Benchmarks
  fetchBenchmarks,
  fetchMetricBenchmarks,
  type BenchmarkData,
  type BenchmarkResult,

  // GeoJSON
  getGeoJsonApiUrl,

  // Market search lists
  fetchMetrosList,
  fetchCountiesList,
  fetchZipsList,
  fetchCitiesList,
  fetchMarketsMetros,
  fetchMarketsCounties,
  fetchMarketsZips,
  fetchMarketsCities,

  // Scoring validation & report templates
  fetchQuintilePerformance,
  fetchReportTemplates,
  fetchValidationSummary,
  fetchValidationQuintiles,
  fetchValidationScatter,
  fetchValidationTimeSeries,
  fetchValidationGeography,
  type ValidationGeography,
  type ValidationScoreType,
  type ValidationSummary,
  type ValidationQuintile,
  type ValidationScatterPoint,
  type ValidationTimeSeriesPoint,
  type ValidationGeographyBreakdown,

  // Pricing
  fetchPricingSummary,
  type PricingTier,

  // Alerts
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  fetchAlertHistory,
  markAlertRead,
  type Alert,
  type AlertHistoryEntry,

  // Billing
  startCheckout,
  getBillingPortalUrl,

  // Recommendations
  fetchMarketsToWatch,
  type MarketRecommendation,

  // Email preferences
  fetchEmailPreferences,
  updateEmailPreferences,
  type EmailPreferences,
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

  // Market snapshot (batch - replaces useDataCardBatch for Markets page)
  useMarketSnapshot,
  type MarketSnapshotCard,
  type UseMarketSnapshotOptions,
  type UseMarketSnapshotResult,

  // Top markets (rankings)
  useTopMarkets,
  type UseTopMarketsOptions,
  type UseTopMarketsResult,

  // Metric access (entitlements gating)
  useMetricAccess,
  type MetricAccessResult,

  // Validation data hooks
  useValidationSummary,
  useValidationQuintiles,
  useValidationScatter,
  useValidationTimeSeries,
  useValidationGeography,
  type UseValidationSummaryOptions,
  type UseValidationQuintilesOptions,
  type UseValidationScatterOptions,
  type UseValidationTimeSeriesOptions,
  type UseValidationGeographyOptions,
} from './hooks';
