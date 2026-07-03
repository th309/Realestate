import { SupabaseClient } from '@supabase/supabase-js';
import type { ScoreResult } from './scoring.service';
import { GeographyLevel, ScoreType, AnyScoreType } from './formula-weights';
import { PredictionRecord } from './performance-tracking.types';

/**
 * Prediction recording + quintile logic extracted from
 * PerformanceTrackingService. I/O helpers take the Supabase client as an
 * explicit first parameter instead of reading it off `this`.
 */

/**
 * Record a prediction for later validation.
 * Called after scores are calculated.
 */
export async function recordScorePrediction(
  supabase: SupabaseClient,
  score: ScoreResult,
): Promise<void> {
  const predictionDate = score.score_date;
  const scoreTypes: ScoreType[] = ['propertyiq'];

  // Calculate quintiles based on all scores for this geography
  const quintiles = await calculateQuintiles(
    supabase,
    score.geography,
    predictionDate,
  );

  for (const scoreType of scoreTypes) {
    const scoreData = score.scores[scoreType];
    if (!scoreData) continue;
    const quintile = getQuintile(scoreData.score, quintiles[scoreType]);

    const record: PredictionRecord = {
      geography: score.geography,
      location_id: score.location_id,
      location_name: score.location_name,
      score_type: scoreType,
      prediction_date: predictionDate,
      predicted_score: scoreData.score,
      predicted_grade: scoreData.grade,
      predicted_quintile: quintile,
      price_at_prediction: score.median_price,
    };

    await savePrediction(supabase, record);
  }
}

/**
 * Record predictions for multiple scores (batch)
 */
export async function recordScorePredictions(
  supabase: SupabaseClient,
  scores: ScoreResult[],
): Promise<{ recorded: number; errors: number }> {
  let recorded = 0;
  let errors = 0;

  for (const score of scores) {
    try {
      await recordScorePrediction(supabase, score);
      recorded++;
    } catch (err) {
      errors++;
      console.error(
        `Error recording prediction for ${score.location_id}:`,
        err,
      );
    }
  }

  return { recorded, errors };
}

async function savePrediction(
  supabase: SupabaseClient,
  record: PredictionRecord,
): Promise<void> {
  const { error } = await supabase.from('score_performance_tracking').upsert(
    {
      geography: record.geography,
      location_id: record.location_id,
      location_name: record.location_name,
      score_type: record.score_type,
      prediction_date: record.prediction_date,
      predicted_score: record.predicted_score,
      predicted_grade: record.predicted_grade,
      predicted_quintile: record.predicted_quintile,
      price_at_prediction: record.price_at_prediction,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: 'geography,location_id,score_type,prediction_date',
    },
  );

  if (error) {
    throw error;
  }
}

async function calculateQuintiles(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<Record<AnyScoreType, number[]>> {
  // Get all scores for this geography and date
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('score_type, score')
    .eq('geography', geography)
    .eq('score_date', periodDate);

  const quintiles: Record<AnyScoreType, number[]> = {
    propertyiq: [],
    homeready: [],
    investoredge: [],
    markethealth: [],
  };

  if (!data || data.length === 0) {
    // Default quintile breakpoints (0, 20, 40, 60, 80, 100)
    for (const scoreType of Object.keys(quintiles) as ScoreType[]) {
      quintiles[scoreType] = [0, 20, 40, 60, 80, 100];
    }
    return quintiles;
  }

  // Group scores by type
  const scoresByType: Record<string, number[]> = {};
  for (const row of data) {
    if (!scoresByType[row.score_type]) {
      scoresByType[row.score_type] = [];
    }
    if (row.score != null) {
      scoresByType[row.score_type].push(row.score);
    }
  }

  // Calculate quintile breakpoints for each score type
  for (const scoreType of Object.keys(quintiles) as ScoreType[]) {
    const scores = scoresByType[scoreType] || [];
    if (scores.length < 5) {
      quintiles[scoreType] = [0, 20, 40, 60, 80, 100];
    } else {
      scores.sort((a, b) => a - b);
      quintiles[scoreType] = [
        scores[0],
        scores[Math.floor(scores.length * 0.2)],
        scores[Math.floor(scores.length * 0.4)],
        scores[Math.floor(scores.length * 0.6)],
        scores[Math.floor(scores.length * 0.8)],
        scores[scores.length - 1],
      ];
    }
  }

  return quintiles;
}

function getQuintile(score: number, breakpoints: number[]): number {
  // 1 = bottom 20%, 5 = top 20%
  if (score >= breakpoints[4]) return 5;
  if (score >= breakpoints[3]) return 4;
  if (score >= breakpoints[2]) return 3;
  if (score >= breakpoints[1]) return 2;
  return 1;
}
