/**
 * Scoring Persistence
 *
 * Database write operations for saving computed PropertyIQ scores.
 * Handles batching, upsert with retry, and row building.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ConfidenceLevel } from './formula-weights';
import { ScoreResult } from './scoring.types';

/** Column-level inputs for a single propertyiq_scores_v2 row. */
export interface ScoreRowInput {
  geography: string;
  locationId: string;
  locationName: string | null;
  score: number | null;
  grade: string | null;
  confidence: number | null;
  confidenceLevel: ConfidenceLevel | null;
  medianPrice: number | null;
  scoreDate: string;
  createdAt: string;
  /** Raw input metrics; stored in the jsonb z_scores column as an OBJECT. */
  zScores: Record<string, number | null> | null;
}

/**
 * Build a single propertyiq_scores_v2 row. THE one place the row/column shape
 * lives, so the batch path (buildScoreRows) and the all-locations calculation
 * path (calculateAndPersistPropertyIqScores) cannot drift.
 *
 * z_scores MUST be an object, not a JSON.stringify'd string: the column is jsonb,
 * so a stringified value is stored as a quoted string and read back as null by
 * every consumer that checks `typeof z_scores === 'object'`.
 */
export function buildScoreRow(input: ScoreRowInput): Record<string, any> {
  return {
    geography: input.geography,
    location_id: input.locationId,
    location_name: input.locationName,
    score_type: 'propertyiq',
    score: input.score,
    grade: input.grade,
    confidence: input.confidence,
    confidence_level: input.confidenceLevel,
    median_price: input.medianPrice,
    score_date: input.scoreDate,
    created_at: input.createdAt,
    z_scores: input.zScores ?? null,
  };
}

/**
 * Build database rows from ScoreResult objects for upsert. Only writes the
 * propertyiq score type — legacy types are historical and no longer computed.
 */
export function buildScoreRows(
  results: ScoreResult[],
  scoreDate: string,
): Array<Record<string, any>> {
  const createdAt = new Date().toISOString();
  const rows: Array<Record<string, any>> = [];
  for (const result of results) {
    const scoreData = result.scores.propertyiq;
    if (!scoreData) continue;
    rows.push(
      buildScoreRow({
        geography: result.geography,
        locationId: result.location_id,
        locationName: result.location_name,
        score: scoreData.score,
        grade: scoreData.grade,
        confidence: scoreData.confidence,
        confidenceLevel: scoreData.confidence_level,
        medianPrice: result.median_price,
        scoreDate,
        createdAt,
        zScores: result.z_scores ?? null,
      }),
    );
  }
  return rows;
}

/**
 * Upsert score rows with exponential backoff retry.
 */
export async function upsertScoresWithRetry(
  supabase: SupabaseClient,
  rows: Array<Record<string, any>>,
): Promise<boolean> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Write to the base table, not the `propertyiq_scores` VIEW: upsert needs a
    // real unique constraint (unique_normalized_score lives on v2). Reads still
    // use the view, which is a 1:1 passthrough of v2.
    const { error } = await supabase.from('propertyiq_scores_v2').upsert(rows, {
      onConflict: 'geography,location_id,score_type,score_date',
    });

    if (!error) return true;

    const delayMs = Math.min(15000, 500 * Math.pow(2, attempt - 1));
    console.error(
      `Error saving score batch (attempt ${attempt}/${maxAttempts}):`,
      error,
    );
    if (attempt < maxAttempts) {
      await sleep(delayMs + Math.floor(Math.random() * 250));
    }
  }
  return false;
}

/**
 * Save a batch of ScoreResults to the database with retry logic.
 */
export async function saveScoresBatch(
  supabase: SupabaseClient,
  results: ScoreResult[],
  scoreDate: string,
): Promise<{ calculated: number; errors: number }> {
  const batchSize = 200; // locations per batch (600 rows)
  let calculated = 0;
  let errors = 0;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const rows = buildScoreRows(batch, scoreDate);
    const ok = await upsertScoresWithRetry(supabase, rows);
    if (ok) {
      calculated += batch.length;
    } else {
      errors += batch.length;
    }

    // Small pause to reduce socket churn during huge backfills
    await sleep(50);
  }

  return { calculated, errors };
}

/**
 * Save a single ScoreResult to the database.
 */
export async function saveScore(
  supabase: SupabaseClient,
  result: ScoreResult,
  scoreDate: string,
): Promise<void> {
  const rows = buildScoreRows([result], scoreDate);
  const ok = await upsertScoresWithRetry(supabase, rows);
  if (!ok) {
    throw new Error(`Failed to save score for ${result.location_id}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
