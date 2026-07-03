/**
 * Reports Data Fetcher
 *
 * Standalone functions that handle the data fetching pipeline for report
 * generation:
 * - Market metrics (snapshot + historical supplement)
 * - State/national benchmarks
 * - Historical time series data
 * - Trend calculation
 *
 * Implementation split across sibling helper modules for file-size compliance;
 * this module re-exports the public API for backward compatibility.
 */

export type {
  MetricProvenance,
  MarketMetricsWithProvenance,
  HistoricalMetricData,
  HistoricalData,
} from './reports-data-fetcher.types';

export { fetchMarketMetrics } from './reports-data-fetcher-market-metrics.helper';
export {
  fetchStateBenchmark,
  fetchNationalBenchmark,
} from './reports-data-fetcher-benchmarks.helper';
export {
  fetchHistoricalData,
  calculateTrendAndChange,
} from './reports-data-fetcher-timeseries.helper';
