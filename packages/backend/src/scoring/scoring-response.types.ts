/**
 * PropertyIQ Scoring — Controller Response Shapes
 *
 * The large inline return-type object literals lifted out of ScoringController /
 * ScoringMarketsController verbatim, so the controllers stay readable. Shapes are
 * byte-for-byte identical to the originals — no field added, removed, or retyped.
 */

/** One row in the map-display "all scores" payload. */
export interface AllScoresRow {
  region_id: string;
  region_name: string;
  value: number;
  grade: string;
  confidence: number;
  confidence_level: string;
  date?: string;
  score_type?: string;
}

/** getAllScores (`GET /api/scores/all/:geography`) response envelope. */
export interface AllScoresResponse {
  success: boolean;
  count: number;
  data: AllScoresRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

/** getScoredIds (`GET /api/scores/ids/:geography`) response envelope. */
export interface ScoredIdsResponse {
  geography: string;
  score_type: string;
  date: string | null;
  count: number;
  ids: string[];
}

/** getScoreDistribution (`GET /api/scores/distribution`) response envelope. */
export interface ScoreDistributionResponse {
  geography: string;
  score_type?: string;
  score_date: string;
  total_count?: number;
  distribution?: Array<{
    bucket: string;
    min: number;
    max: number;
    count: number;
    percentage: number;
  }>;
  statistics?: {
    mean: number;
    median: number;
    std_dev: number;
    min: number;
    max: number;
  };
  grade_distribution?: Array<{
    grade: string;
    count: number;
    percentage: number;
  }>;
  distributions?: Record<string, any>;
}
