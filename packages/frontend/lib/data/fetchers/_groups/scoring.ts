/**
 * SCORING FETCHERS
 *
 * PropertyIQ scores, validation, benchmarks, personalized market match.
 */

// Score data (PropertyIQ)
export {
  fetchScore,
  fetchBatchScores,
  fetchScoreExpanded,
  fetchTopMarkets,
  type TopMarketsGeo,
  type TopMarketsScoreType,
  type TopMarketEntry,
} from "../scores";

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
} from "../scoring";

// Benchmarks
export {
  fetchBenchmarks,
  fetchMetricBenchmarks,
  type BenchmarkData,
  type BenchmarkResult,
} from "../benchmarks";

// Market match (personalized scores)
export {
  fetchTopMarketMatches,
  fetchMarketMatch,
  type MatchScoreResult,
  type MetricBreakdownEntry,
} from "../market-match";
