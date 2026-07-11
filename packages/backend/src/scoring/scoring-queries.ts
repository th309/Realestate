/**
 * Scoring Queries (barrel)
 *
 * All database read operations for pre-computed PropertyIQ scores.
 * These query the propertyiq_scores and propertyiq_backtest_outcomes tables.
 *
 * Implementation is split by concern across sibling modules; this file
 * re-exports the full public surface so existing importers stay unchanged.
 */

export {
  getLatestScoreDate,
  getScoreDatesForLocation,
  getScoreDates,
} from './scoring-queries-dates';
export {
  getScoreForDate,
  getLatestScoresForLocation,
  getOutcomesForLocation,
} from './scoring-queries-location';
export {
  getScoredLocationIds,
  getTopMarkets,
  searchMarkets,
} from './scoring-queries-rankings';
export {
  fetchScoresPage,
  fetchAllScoresBatched,
} from './scoring-queries-pagination';
export type { ScorePageRow } from './scoring-queries-pagination';
export {
  bucketScores,
  getScoreDistribution,
  MOMENTUM_BANDS,
} from './scoring-queries-distribution';
export type {
  ScoreDistribution,
  ScoreDistributionBucket,
} from './scoring-queries-distribution';
