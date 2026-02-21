/**
 * Scoring Persistence
 *
 * Database write operations for saving computed PropertyIQ scores.
 * Handles batching, upsert with retry, and row building.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType } from './formula-weights';
import { ScoreResult } from './scoring.types';

/**
 * Build database rows from ScoreResult objects for upsert.
 */
export function buildScoreRows(
  results: ScoreResult[],
  scoreDate: string,
): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  const createdAt = new Date().toISOString();
  for (const result of results) {
    for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as ScoreType[]) {
      const scoreData = result.scores[scoreType];
      rows.push({
        geography: result.geography,
        location_id: result.location_id,
        location_name: result.location_name,
        score_type: scoreType,
        score: scoreData.score,
        grade: scoreData.grade,
        confidence: scoreData.confidence,
        confidence_level: scoreData.confidence_level,
        median_price: result.median_price,
        score_date: scoreDate,
        created_at: createdAt,
        z_scores: result.z_scores || null,
      });
    }
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
    const { error } = await supabase
      .from('propertyiq_scores')
      .upsert(rows, { onConflict: 'geography,location_id,score_type,score_date' });

    if (!error) return true;

    const delayMs = Math.min(15000, 500 * Math.pow(2, attempt - 1));
    console.error(`Error saving score batch (attempt ${attempt}/${maxAttempts}):`, error);
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
