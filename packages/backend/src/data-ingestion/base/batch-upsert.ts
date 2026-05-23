/**
 * Batch upsert helper with retry on transient connection errors.
 *
 * Mirrors the script-side helper at `scripts/lib/batch-upsert.ts` so the
 * backend services and CLI importers share identical batching semantics:
 *  - configurable batch size (default 1000)
 *  - 3 retry attempts with 2s / 4s exponential backoff
 *  - 200ms pause between batches to avoid hammering the DB
 *  - per-batch progress callback
 *
 * Replaces the inline upsert loops that previously lived in all four
 * backend services with slight variations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const PAUSE_BETWEEN_BATCHES_MS = 200;

const CONNECTION_ERROR_PATTERNS = [
  'fetch',
  'network',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'socket',
  'timeout',
  'canceling statement',
];

function isConnectionError(message: string): boolean {
  const lower = message.toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BatchUpsertOptions {
  tableName: string;
  /** Comma-joined conflict columns, e.g. "region_id,period_date,metric_name". */
  onConflict: string;
  batchSize?: number;
  /** Called after each batch attempt (success or terminal failure). */
  onProgress?: (insertedSoFar: number, failedSoFar: number) => void;
}

export interface BatchUpsertResult {
  inserted: number;
  failed: number;
  errors: string[];
}

/**
 * Upsert records in batches. Retries each batch up to MAX_RETRIES on
 * transient connection errors; logs and continues on terminal failures.
 */
export async function batchUpsertWithRetry<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  records: T[],
  options: BatchUpsertOptions,
): Promise<BatchUpsertResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const result: BatchUpsertResult = { inserted: 0, failed: 0, errors: [] };

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    let attempt = 0;
    let landed = false;

    while (attempt < MAX_RETRIES && !landed) {
      attempt += 1;
      const { error } = await supabase.from(options.tableName).upsert(batch, {
        onConflict: options.onConflict,
        ignoreDuplicates: false,
      });

      if (!error) {
        result.inserted += batch.length;
        landed = true;
        break;
      }

      if (isConnectionError(error.message) && attempt < MAX_RETRIES) {
        await sleep(BASE_RETRY_DELAY_MS * attempt);
        continue;
      }

      result.failed += batch.length;
      result.errors.push(
        `Batch ${Math.floor(i / batchSize)} (${batch.length} rows): ${error.message}`,
      );
      break;
    }

    options.onProgress?.(result.inserted, result.failed);

    if (i + batchSize < records.length) {
      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }
  }

  return result;
}
