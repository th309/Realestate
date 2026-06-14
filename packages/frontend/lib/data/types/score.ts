/**
 * SCORE DATA TYPES
 */

/**
 * Score types available in the system
 */
export type ScoreType = "propertyiq";

/**
 * Confidence level for a score
 */
export type ConfidenceLevel = "A" | "B" | "C" | "F";

/**
 * Status label for a score component based on its normalized score.
 * Mirrors backend ComponentStatus from scoring.types.ts.
 */
export type ComponentStatus =
  | "excellent"
  | "strong"
  | "moderate"
  | "watch"
  | "concern";

/**
 * Breakdown of a single component's contribution to an overall score.
 * Each score type is composed of 3-5 components (e.g., HomeReady has
 * affordability, market_timing, stability, growth_potential).
 * Mirrors backend ScoreComponentBreakdown from scoring.types.ts.
 */
export interface ScoreComponentBreakdown {
  /** Component name (e.g., 'affordability', 'market_timing') */
  component: string;
  /** Normalized component score (0-100) */
  score: number;
  /** Weight of this component in the overall score (0-1, sums to ~1.0) */
  weight: number;
  /** Quick-read status label based on score thresholds */
  status: ComponentStatus;
  /** Individual metrics that contribute to this component */
  contributing_metrics: {
    /** Metric name as used in formula weights */
    metric: string;
    /** Standardized z-score for this metric */
    z_score: number;
    /** Whether higher values help or hurt the score */
    direction: "positive" | "negative";
    /** Raw metric value before standardization, null if unavailable */
    raw_value: number | null;
  }[];
}

/**
 * Result for a single score
 */
export interface SingleScoreResult {
  score: number;
  grade: string;
  confidence: number;
  confidence_level: ConfidenceLevel;
  /** Per-component breakdown when requested (pro/enterprise tiers) */
  components?: ScoreComponentBreakdown[];
}

/**
 * Full score response for a location
 */
export interface ScoreResponse {
  location_id: string;
  location_name: string;
  geography: string;
  median_price: number | null;
  score_date: string;
  scores: {
    propertyiq: SingleScoreResult;
  };
  /** Per-metric z-scores (available when expanded=true) */
  z_scores?: Record<string, number>;
  return_1y?: number;
  return_3y_ann?: number;
}

/**
 * Batch score response for multiple locations
 */
export interface BatchScoreResponse {
  geographyType: string;
  periodDate?: string;
  scores: (ScoreResponse | { geographyId: string; error: string })[];
}
