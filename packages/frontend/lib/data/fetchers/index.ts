/**
 * FETCHERS BARREL EXPORT
 *
 * Re-exports all data fetching functions from a single entry point.
 */

// Base utilities
export { API_URL, fetchAPI, fetchAPIWithParams, fetchAPIRaw } from './base';

// Snapshot data (current values)
export {
  fetchSnapshotData,
  fetchMetricData,
  toHomeValues,
} from './snapshot';

// Time series data (historical values)
export {
  fetchTimeSeriesData,
  fetchAvailableDates,
  timeSeriesApi,
} from './timeseries';

// Trend data (change calculations)
export {
  fetchTrendData,
  fetchTrendDataBatch,
  normalizeSparklineData,
} from './trend';

// Score data (PropertyIQ)
export {
  fetchScore,
  fetchBatchScores,
  fetchScoreExpanded,
  fetchTopMarkets,
  type TopMarketsGeo,
  type TopMarketsScoreType,
  type TopMarketEntry,
} from './scores';

// Market data (stats, lists)
export { fetchMarketStats, type MarketStats } from './markets';

// Market AI analysis
export {
  fetchMarketAnalysis,
  type MarketAnalysisSection,
  type MarketAnalysisResult,
} from './market-analysis';

// Market snapshot (batch)
export {
  fetchMarketSnapshot,
  type MarketSnapshotMetric,
  type MarketSnapshotScoreEntry,
  type MarketSnapshotResponse,
} from './market-snapshot';

// Batch trends (server-side)
export { fetchBatchTrendsServer, type BatchTrendEntry } from './trend';

// Reports
export {
  fetchReport,
  fetchSampleReport,
  fetchSharedReport,
  createReportShareLink,
  fetchReportHistory,
  fetchReportList,
  generateReport,
  regenerateNarratives,
  type GenerateReportRequest,
  type GenerateReportResponse,
} from './reports';

// Benchmarks
export {
  fetchBenchmarks,
  fetchMetricBenchmarks,
  type BenchmarkData,
  type BenchmarkResult,
} from './benchmarks';

// Alerts
export {
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  fetchAlertHistory,
  markAlertRead,
  type Alert,
  type AlertHistoryEntry,
} from './alerts';

// Billing
export { startCheckout, getBillingPortalUrl } from './billing';

// Recommendations
export {
  fetchMarketsToWatch,
  type MarketRecommendation,
} from './recommendations';

// GeoJSON
export { getGeoJsonApiUrl } from './geojson';

// Data freshness (canonical "as of" dates for UI)
export { fetchDataFreshness, type DataFreshnessResponse } from './freshness';

// Market search lists & geography search
export {
  fetchGeographySearch,
  type GeographySearchResult,
  fetchMetrosList,
  fetchCountiesList,
  fetchZipsList,
  fetchCitiesList,
  fetchMarketsMetros,
  fetchMarketsCounties,
  fetchMarketsZips,
  fetchMarketsCities,
} from './search';

// Scoring validation & report templates
export {
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
} from './scoring';

// Pricing (admin features)
export { fetchPricingSummary, type PricingTier, type TrialInfo, type PricingSummary } from './pricing';

// Email preferences
export {
  fetchEmailPreferences,
  updateEmailPreferences,
  type EmailPreferences,
} from './email-preferences';

// Support
export { submitSupportTicket, type SupportTicket } from './support';
