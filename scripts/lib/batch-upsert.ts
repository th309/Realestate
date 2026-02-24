/**
 * Batch upsert with exponential backoff retry for Supabase.
 *
 * Splits records into configurable-size batches, upserts each batch,
 * retries on connection errors (up to 3 attempts with 2s/4s delays),
 * and reports progress via callback.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BatchUpsertOptions, BatchUpsertResult } from './types';

const DEFAULT_BATCH_SIZE = 5000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const PAUSE_BETWEEN_BATCHES_MS = 200;

/** Substrings in error messages that indicate a transient connection problem. */
const CONNECTION_ERROR_PATTERNS = [
  'fetch', 'network', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'socket',
  'timeout', 'canceling statement',
];

/**
 * Check if an error message indicates a transient connection issue
 * that is worth retrying.
 */
function isConnectionError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upsert a single batch with retry logic.
 * Returns the number of records inserted, or throws after exhausting retries.
 */
async function upsertBatchWithRetry(
  supabase: SupabaseClient,
  tableName: string,
  records: Record<string, unknown>[],
  conflictKeys: string[],
  batchIndex: number,
  totalBatches: number,
): Promise<{ inserted: number; error: string | null }> {
  const conflictString = conflictKeys.join(',');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from(tableName)
        .upsert(records, { onConflict: conflictString, ignoreDuplicates: false });

      if (error) {
        if (isConnectionError(error.message) && attempt < MAX_RETRIES) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`  Connection error on batch ${batchIndex + 1}/${totalBatches}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
          await sleep(delay);
          continue;
        }
        return { inserted: 0, error: `Batch ${batchIndex + 1}: ${error.message}` };
      }

      return { inserted: records.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (isConnectionError(message) && attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`  Exception on batch ${batchIndex + 1}/${totalBatches}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }
      return { inserted: 0, error: `Batch ${batchIndex + 1}: ${message}` };
    }
  }

  // Should not reach here, but just in case
  return { inserted: 0, error: `Batch ${batchIndex + 1}: exhausted all retries` };
}

/**
 * Upsert records into a Supabase table in batches with retry logic.
 *
 * - Splits records into chunks of `batchSize` (default 5000)
 * - Each batch retries up to 3 times on connection errors (2s, 4s backoff)
 * - Logs progress on the first batch, every 10th batch, and the last batch
 * - 200ms pause between batches to avoid overwhelming the database
 * - Calls `onProgress` callback after each batch with cumulative counts
 */
export async function batchUpsert(
  supabase: SupabaseClient,
  records: Record<string, unknown>[],
  options: BatchUpsertOptions,
): Promise<BatchUpsertResult> {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const totalBatches = Math.ceil(records.length / batchSize);
  const result: BatchUpsertResult = { inserted: 0, failed: 0, errors: [] };

  if (records.length === 0) {
    return result;
  }

  console.log(`  Upserting ${records.length} records into ${options.tableName} (${totalBatches} batches of ${batchSize})...`);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const batch = records.slice(start, start + batchSize);

    const { inserted, error } = await upsertBatchWithRetry(
      supabase, options.tableName, batch, options.conflictKeys, i, totalBatches,
    );

    if (error) {
      result.failed += batch.length;
      result.errors.push(error);
    } else {
      result.inserted += inserted;
    }

    // Log progress on first, every 10th, and last batch
    const isFirstBatch = i === 0;
    const isProgressBatch = (i + 1) % 10 === 0;
    const isLastBatch = i === totalBatches - 1;
    if (isFirstBatch || isProgressBatch || isLastBatch) {
      console.log(`  Batch ${i + 1}/${totalBatches}: ${result.inserted} inserted, ${result.failed} failed`);
    }

    // Notify progress callback
    if (options.onProgress) {
      options.onProgress(result.inserted, result.failed);
    }

    // Pause between batches (skip after last)
    if (!isLastBatch) {
      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }
  }

  return result;
}
