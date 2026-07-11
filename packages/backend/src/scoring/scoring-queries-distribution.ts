/**
 * Scoring Queries — Momentum-Band Distribution
 *
 * Aggregate distribution of the latest scores across a geography, powering
 * the /forecast national hub ("of N scored metros, X% show easing momentum").
 * Exists because /api/scores/top clamps limit to 100 and cannot serve the
 * full scored set.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel } from './formula-weights';
import { getLatestScoreDate } from './scoring-queries-dates';
import { fetchAllScoresBatched } from './scoring-queries-pagination';

export interface ScoreDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ScoreDistribution {
  date: string | null;
  total: number;
  buckets: ScoreDistributionBucket[];
}

/** Momentum bands per CLAUDE.md section 9 score labels. */
export const MOMENTUM_BANDS = [
  { label: 'VERY STRONG', min: 90, max: 99 },
  { label: 'STRONG', min: 80, max: 89 },
  { label: 'RISING', min: 70, max: 79 },
  { label: 'FIRMING', min: 60, max: 69 },
  { label: 'STEADY', min: 50, max: 59 },
  { label: 'EASING', min: 40, max: 49 },
  { label: 'WEAK', min: 20, max: 39 },
  { label: 'VERY WEAK', min: 1, max: 19 },
] as const;

export function bucketScores(scores: number[]): ScoreDistributionBucket[] {
  return MOMENTUM_BANDS.map((band) => ({
    ...band,
    count: scores.filter((s) => s >= band.min && s <= band.max).length,
  }));
}

export async function getScoreDistribution(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
): Promise<ScoreDistribution> {
  const date = await getLatestScoreDate(supabase, geography, scoreType);
  if (!date) {
    return { date: null, total: 0, buckets: bucketScores([]) };
  }
  const { data } = await fetchAllScoresBatched(
    supabase,
    geography,
    scoreType,
    date,
    1000,
    4,
  );
  const scores = data.map((row) => row.score);
  return { date, total: scores.length, buckets: bucketScores(scores) };
}
