/**
 * Upsert helper and record-merge utility for Census/Economic imports.
 *
 * Wraps the shared batchUpsert() with ingestion logging, and provides
 * a mergeByKey() function to combine records from multiple API sources
 * (FRED unemployment + BEA GDP + BEA RPP) into single composite rows.
 */

import { getSupabaseClient, batchUpsert } from '../../lib';
import type { BatchUpsertResult } from '../../lib';
import { createIngestionLogger } from '../../utils/ingestion-logger';
import type { IngestionSource } from '../../utils/ingestion-logger';

// ---------------------------------------------------------------------------
// Upsert with ingestion logging
// ---------------------------------------------------------------------------

export interface UpsertWithLoggingOptions {
  source: IngestionSource;
  tableName: string;
  conflictKeys: string[];
  datasetId: string;
  records: Record<string, unknown>[];
}

export async function upsertWithLogging(options: UpsertWithLoggingOptions): Promise<BatchUpsertResult> {
  const supabase = getSupabaseClient();
  const logger = createIngestionLogger(supabase, {
    source: options.source,
    tableName: options.tableName,
    datasetId: options.datasetId,
  });

  console.log(`\n--- Upserting ${options.records.length} records into ${options.tableName} ---`);

  if (options.records.length === 0) {
    console.log('  No records to upsert, skipping.');
    return { inserted: 0, failed: 0, errors: [] };
  }

  await logger.start(0);

  const result = await batchUpsert(supabase, options.records, {
    tableName: options.tableName,
    conflictKeys: options.conflictKeys,
    batchSize: 5000,
  });

  if (result.inserted > 0) {
    await logger.complete({
      recordsProcessed: options.records.length,
      recordsSuccess: result.inserted,
      recordsError: result.failed,
      errors: result.errors,
    });
  } else {
    await logger.fail(result.errors.join('; ') || 'No records inserted');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Merge records from different API sources by composite key
// ---------------------------------------------------------------------------

/**
 * Merge an array of partial records into composite rows keyed by
 * one or more fields. When two records share the same key, non-null
 * values from the newer record overwrite nulls in the existing one.
 *
 * Example: mergeByKey([fredRow, beaRow], 'period_date', 'state_fips')
 * produces one row with both unemployment_rate and gdp_millions.
 */
export function mergeByKey(
  records: Record<string, unknown>[],
  ...keyFields: string[]
): Record<string, unknown>[] {
  const mergeMap = new Map<string, Record<string, unknown>>();

  for (const record of records) {
    const key = keyFields.map(f => String(record[f] ?? '')).join('|');
    const existing = mergeMap.get(key);
    if (existing) {
      for (const [field, value] of Object.entries(record)) {
        if (value !== null && value !== undefined) {
          existing[field] = value;
        }
      }
    } else {
      mergeMap.set(key, { ...record });
    }
  }

  return Array.from(mergeMap.values());
}
