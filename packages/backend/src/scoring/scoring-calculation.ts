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
import { buildScoreRow, upsertScoresWithRetry } from './scoring-persistence';

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

  // 4. Build rows via the shared row builder so this path and the batch path
  // (buildScoreRows) can't drift. z_scores is passed as an OBJECT — the column is
  // jsonb, so stringifying it would be stored as a quoted string and read back as
  // null by every consumer that checks `typeof z_scores === 'object'`.
  const createdAt = new Date().toISOString();
  const rows = results.map((r) =>
    buildScoreRow({
      geography,
      locationId: r.locationId,
      locationName: r.locationName,
      score: r.score,
      grade: r.grade,
      confidence: r.confidence,
      confidenceLevel: r.confidenceLevel,
      medianPrice: r.medianPrice,
      scoreDate,
      createdAt,
      zScores: r.inputMetrics,
    }),
  );

  // 5. Persist in batches. A single upsert of every row (e.g. ~29K zips) exceeds
  // Postgres statement_timeout (error 57014) and writes nothing; chunking keeps
  // each statement well under the limit. Track real stored/failed counts so a
  // timeout surfaces as `errors` instead of a silent false success — the previous
  // code ignored the upsert result and always reported `errors: 0`, so a timed-out
  // zip batch logged "29213 scored" while the DB received nothing.
  const PERSIST_BATCH_SIZE = 500;
  let stored = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += PERSIST_BATCH_SIZE) {
    const chunk = rows.slice(i, i + PERSIST_BATCH_SIZE);
    const ok = await upsertScoresWithRetry(supabase, chunk);
    if (ok) stored += chunk.length;
    else failed += chunk.length;
  }

  return { calculated: stored, errors: failed, scoreDate };
}
