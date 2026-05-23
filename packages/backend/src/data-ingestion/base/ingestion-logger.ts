/**
 * Wrapper around `data_ingestion_logs` writes.
 *
 * Prior to this helper, only ZillowService wrote to the logs table — Fred,
 * Realtor, and Census all skipped it, making operational visibility
 * inconsistent. The new helper gives every service the same shape:
 *
 *   await logger.log({ status, recordsProcessed, recordsInserted, errorMessage });
 *
 * Schema preserved from the original Zillow insert:
 *   { source, dataset, status, records_processed, records_inserted, error_message }
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineStatus } from './pipeline-reporter';

export interface IngestionLogPayload {
  status: PipelineStatus;
  recordsProcessed: number;
  recordsInserted: number;
  errorMessage?: string | null;
}

export class IngestionLogger {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly source: string,
    private readonly dataset: string,
  ) {}

  /**
   * Insert a single summary row. Errors are swallowed (logging must never
   * block an import). Returns true on success, false on insertion failure.
   */
  async log(payload: IngestionLogPayload): Promise<boolean> {
    const { error } = await this.supabase.from('data_ingestion_logs').insert({
      source: this.source,
      dataset: this.dataset,
      status: payload.status,
      records_processed: payload.recordsProcessed,
      records_inserted: payload.recordsInserted,
      error_message: payload.errorMessage ?? null,
    });
    return !error;
  }
}
