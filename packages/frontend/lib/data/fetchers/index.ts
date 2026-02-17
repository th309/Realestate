/**
 * FETCHERS BARREL EXPORT
 *
 * Re-exports all data fetching functions from a single entry point.
 */

// Base utilities
export { API_URL, fetchAPI, fetchAPIWithParams } from './base';

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
export { regenerateNarratives } from './reports';
