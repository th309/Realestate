/**
 * PropertyIQ Scoring — All-Locations Calculation Orchestration
 *
 * Free function (taking the Supabase client explicitly, mirroring
 * scoring-queries.ts) that computes and persists PropertyIQ demand-signal
 * scores for every location at a geography level. Delegates metric assembly to
 * propertyiq-data-fetcher.ts, the score math to propertyiq-scoring-engine.ts,
 * and the upsert to scoring-persistence.ts.
 *
 * Extracted verbatim from ScoringService.calculatePropertyIqScores — pure
 * structural extraction, no behavior changes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { calculatePropertyIqScores as runEngine } from './propertyiq-scoring-engine';
import {
  fetchPropertyIqMetrics,
  getLatestScorableDate,
} from './propertyiq-data-fetcher';
import { upsertScoresWithRetry } from './scoring-persistence';

/**
 * Calculate demand-signal scores for all locations at a given geography level.
 * Uses the 4 PropertyIQ formula inputs: zhvi_yoy and zhvi_mom_3m (derived from
 * Zillow ZHVI momentum) plus median_days_on_market and price_reduced_share
 * (Realtor.com market flow). Coverage is the union of Zillow and Realtor regions.
 */
export async function calculateAndPersistPropertyIqScores(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate?: string,
): Promise<{ calculated: number; errors: number; scoreDate: string }> {
  // 1. Get the latest scorable month-end (min of latest Zillow + Realtor) if not specified
  const scoreDate =
    periodDate || (await getLatestScorableDate(supabase, geography));
  if (!scoreDate) {
    throw new Error(`No scorable Zillow/Realtor data found for ${geography}`);
  }

  // 2. Fetch the 4 formula inputs (Zillow momentum + Realtor flow)
  const locations = await fetchPropertyIqMetrics(
    supabase,
    geography,
    scoreDate,
  );
  if (locations.length === 0) {
    return { calculated: 0, errors: 0, scoreDate };
  }

  // 3. Calculate scores using the demand-signal engine
  const results = runEngine(locations, geography);

  // 4. Build rows for persistence
  // Note: there is no formula_version column in propertyiq_scores_v2 — omit it.
  // score_type='propertyiq' is the single live score type.
  const rows = results.map((r) => ({
    geography,
    location_id: r.locationId,
    location_name: r.locationName,
    score_type: 'propertyiq' as const,
    score: r.score,
    grade: r.grade,
    confidence: r.confidence,
    confidence_level: r.confidenceLevel,
    median_price: r.medianPrice,
    score_date: scoreDate,
    created_at: new Date().toISOString(),
    z_scores: JSON.stringify(r.inputMetrics),
  }));

  // 5. Persist
  await upsertScoresWithRetry(supabase, rows);

  return { calculated: results.length, errors: 0, scoreDate };
}
