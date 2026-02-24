/**
 * Ingestion Logger Utility
 *
 * Shared logging utility for tracking data import progress in the data_ingestion_log table.
 * All import scripts should use this to ensure consistent logging.
 *
 * Table schema (data_ingestion_log):
 * - id: UUID
 * - source: TEXT (e.g., 'zillow', 'realtor', 'census', 'bls', 'fred', 'hud', 'permits')
 * - table_name: TEXT
 * - metric_name: TEXT (optional)
 * - dataset_id: TEXT (optional)
 * - records_processed: INTEGER
 * - records_success: INTEGER
 * - records_error: INTEGER
 * - status: TEXT ('running', 'success', 'partial', 'failed')
 * - error_message: TEXT
 * - started_at: TIMESTAMPTZ
 * - completed_at: TIMESTAMPTZ
 * - duration_ms: INTEGER
 * - created_at: TIMESTAMPTZ
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type IngestionSource = 'zillow' | 'realtor' | 'census' | 'bls' | 'fred' | 'hud' | 'permits' | 'redfin';
export type IngestionStatus = 'running' | 'success' | 'partial' | 'failed';

export interface IngestionLogParams {
  source: IngestionSource;
  tableName: string;
  metricName?: string;
  datasetId?: string;
  recordsProcessed?: number;
}

export interface IngestionLogResult {
  recordsProcessed: number;
  recordsSuccess: number;
  recordsError: number;
  errors: string[];
}

export class IngestionLogger {
  private supabase: SupabaseClient;
  private logId: string | null = null;
  private startTime: number = 0;
  private params: IngestionLogParams;

  constructor(supabase: SupabaseClient, params: IngestionLogParams) {
    this.supabase = supabase;
    this.params = params;
  }

  /**
   * Start the ingestion log entry
   */
  async start(recordsProcessed?: number): Promise<string | null> {
    this.startTime = Date.now();

    try {
      const { data, error } = await this.supabase
        .from('data_ingestion_log')
        .insert({
          source: this.params.source,
          table_name: this.params.tableName,
          metric_name: this.params.metricName || null,
          dataset_id: this.params.datasetId || null,
          status: 'running',
          records_processed: recordsProcessed ?? this.params.recordsProcessed ?? 0,
          records_success: 0,
          records_error: 0,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!error && data) {
        this.logId = data.id;
        console.log(`📝 Started ingestion log: ${data.id}`);
        return data.id;
      } else if (error) {
        console.warn('Could not start ingestion log:', error.message);
      }
    } catch (e: any) {
      console.warn('Could not start ingestion log:', e.message);
    }

    return null;
  }

  /**
   * Update progress during the import
   */
  async updateProgress(recordsSuccess: number, recordsError: number = 0): Promise<void> {
    if (!this.logId) return;

    try {
      await this.supabase
        .from('data_ingestion_log')
        .update({
          records_success: recordsSuccess,
          records_error: recordsError,
        })
        .eq('id', this.logId);
    } catch (e) {
      // Silently fail - don't interrupt the import
    }
  }

  /**
   * Complete the ingestion log entry
   */
  async complete(result: IngestionLogResult): Promise<void> {
    if (!this.logId) return;

    const durationMs = Date.now() - this.startTime;
    let status: IngestionStatus;

    if (result.recordsError > 0 && result.recordsSuccess > 0) {
      status = 'partial';
    } else if (result.recordsError > 0 || result.errors.length > 0) {
      status = 'failed';
    } else {
      status = 'success';
    }

    try {
      await this.supabase
        .from('data_ingestion_log')
        .update({
          status,
          records_processed: result.recordsProcessed,
          records_success: result.recordsSuccess,
          records_error: result.recordsError,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_message: result.errors.length > 0 ? result.errors.slice(0, 5).join('; ') : null,
        })
        .eq('id', this.logId);

      const statusIcon = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌';
      console.log(`${statusIcon} Ingestion log completed: ${status} (${(durationMs / 1000).toFixed(1)}s)`);
    } catch (e: any) {
      console.warn('Error completing ingestion log:', e.message);
    }
  }

  /**
   * Mark the import as failed
   */
  async fail(errorMessage: string): Promise<void> {
    if (!this.logId) return;

    const durationMs = Date.now() - this.startTime;

    try {
      await this.supabase
        .from('data_ingestion_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_message: errorMessage,
        })
        .eq('id', this.logId);

      console.log(`❌ Ingestion log failed: ${errorMessage}`);
    } catch (e: any) {
      console.warn('Error marking ingestion log as failed:', e.message);
    }
  }
}

/**
 * Create a new ingestion logger
 */
export function createIngestionLogger(
  supabase: SupabaseClient,
  params: IngestionLogParams
): IngestionLogger {
  return new IngestionLogger(supabase, params);
}
