/**
 * Database view used for peer-market lookups + market-core summaries.
 *
 * Phase 01 Task 13 reconciles whether this view actually exists with these
 * exact columns; until then both PeersService and MarketsService.getMarketCore
 * point at this name.
 */
export const GEOGRAPHIES_WITH_SCORES_VIEW = 'geographies_with_scores';

/**
 * Weighting factor applied to size-distance vs score-distance when ranking peer
 * markets. Score is a 0-100 integer; sizeDist is a normalized ratio (0..N).
 * Without weighting, sizeDist would dominate small-score-difference comparisons.
 *
 * Tunable: increase to favor markets of similar population, decrease to favor
 * markets of similar PropertyIQ score. Phase 01 Task 13 + telemetry will inform
 * the right value once real peer-comparison data is in production.
 */
export const SIZE_DISTANCE_WEIGHT = 10;
