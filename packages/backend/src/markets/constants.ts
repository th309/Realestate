/**
 * Weighting factor applied to size-distance vs score-distance when ranking peer
 * markets. Score is a 0-100 integer; sizeDist is a normalized ratio (0..N).
 * Without weighting, sizeDist would dominate small-score-difference comparisons.
 *
 * Tunable: increase to favor markets of similar population, decrease to favor
 * markets of similar PropertyIQ score.
 */
export const SIZE_DISTANCE_WEIGHT = 10;
