/**
 * Pipeline Runs Service
 *
 * Retrieves recent ETL pipeline runs from the data_ingestion_log table.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface PipelineRun {
  id: string;
  pipelineName: string;
  displayName: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  durationMs: number | null;
  errorMessage?: string;
}

export interface PipelineRunsResponse {
  pipelines: PipelineRun[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    running: number;
  };
}

const PIPELINE_DISPLAY_NAMES: Record<string, string> = {
  zillow_zhvi: 'Zillow ZHVI',
  zillow_zori: 'Zillow ZORI',
  zillow_market: 'Zillow Market',
  census_population: 'Census Population',
  census_income: 'Census Income',
  bls_unemployment: 'BLS Unemployment',
  realtor_metrics: 'Realtor Metrics',
  hud_fmr: 'HUD FMR',
  permits: 'Building Permits',
  calculated_metrics: 'Calculated Metrics',
};

@Injectable()
export class PipelineRunsService {
  private readonly logger = new Logger(PipelineRunsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getRecentRuns(hours: number = 72): Promise<PipelineRunsResponse> {
    const client = this.supabase.getClient();

    try {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await client
        .from('data_ingestion_log')
        .select('*')
        .gte('started_at', cutoffDate)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        this.logger.warn(`Error fetching pipeline runs: ${error.message}`);
        return {
          pipelines: [],
          summary: { total: 0, successful: 0, failed: 0, running: 0 },
        };
      }

      const pipelines: PipelineRun[] = (data || []).map((row) => ({
        id: row.id,
        pipelineName: row.source_name,
        displayName: PIPELINE_DISPLAY_NAMES[row.source_name] || row.source_name,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        status: this.mapStatus(row.status),
        recordsProcessed: row.records_processed || 0,
        recordsInserted: row.records_inserted || 0,
        recordsFailed: row.records_failed || 0,
        durationMs: row.execution_time_ms,
        errorMessage: row.error_message,
      }));

      return {
        pipelines,
        summary: {
          total: pipelines.length,
          successful: pipelines.filter((p) => p.status === 'success').length,
          failed: pipelines.filter((p) => p.status === 'failed').length,
          running: pipelines.filter((p) => p.status === 'running').length,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching pipeline runs:', error);
      return {
        pipelines: [],
        summary: { total: 0, successful: 0, failed: 0, running: 0 },
      };
    }
  }

  async triggerPipeline(pipelineName: string): Promise<{ success: boolean; message: string }> {
    // TODO: Implement actual pipeline triggering via job queue
    this.logger.log(`Pipeline trigger requested: ${pipelineName}`);
    return {
      success: true,
      message: `Pipeline ${pipelineName} trigger queued`,
    };
  }

  private mapStatus(dbStatus: string): PipelineRun['status'] {
    const statusMap: Record<string, PipelineRun['status']> = {
      running: 'running',
      success: 'success',
      completed: 'success',
      failed: 'failed',
      error: 'failed',
      partial: 'partial',
    };
    return statusMap[dbStatus?.toLowerCase()] || 'failed';
  }

}
