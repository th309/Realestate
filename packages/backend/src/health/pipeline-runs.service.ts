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

export interface RunDetail {
  metricName: string;
  geography: string;
  status: 'success' | 'failed' | 'skipped';
  recordsInserted: number;
  recordsFailed: number;
  recordsDelta: number;
  periodsAdded: string[];
  latestDataDate: string | null;
  freshnessDays: number;
  coveragePct: number;
  coverageDelta: number;
  durationMs: number;
  errorMessage: string | null;
}

export interface RunDetailsResponse {
  runId: string;
  pipelineName: string;
  details: RunDetail[];
  summary: {
    totalMetrics: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

const PIPELINE_DISPLAY_NAMES: Record<string, string> = {
  zillow: 'Zillow',
  realtor: 'Realtor',
  census: 'Census ACS',
  census_acs: 'Census ACS',
  bls: 'BLS',
  fred: 'FRED',
  hud: 'HUD FMR',
  hud_fmr: 'HUD FMR',
  permits: 'Building Permits',
  building_permits: 'Building Permits',
  redfin: 'Redfin',
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
        pipelineName: row.source,
        displayName: PIPELINE_DISPLAY_NAMES[row.source] || row.source,
        startedAt: row.started_at,
        endedAt: row.completed_at,
        status: this.mapStatus(row.status),
        recordsProcessed: row.records_processed || 0,
        recordsInserted: row.records_success || 0,
        recordsFailed: row.records_error || 0,
        durationMs: row.duration_ms,
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

  async getRunDetails(runId: string): Promise<RunDetailsResponse> {
    const client = this.supabase.getClient();

    // Get parent run for pipeline name
    const { data: run } = await client
      .from('data_ingestion_log')
      .select('source')
      .eq('id', runId)
      .single();

    // Get detail rows
    const { data, error } = await client
      .from('data_ingestion_details')
      .select('*')
      .eq('run_id', runId)
      .order('status', { ascending: true })
      .order('metric_name', { ascending: true })
      .order('geography', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch run details: ${error.message}`);
    }

    const details: RunDetail[] = (data || []).map((row) => ({
      metricName: row.metric_name,
      geography: row.geography,
      status: row.status,
      recordsInserted: row.records_inserted || 0,
      recordsFailed: row.records_failed || 0,
      recordsDelta: row.records_delta || 0,
      periodsAdded: row.periods_added || [],
      latestDataDate: row.latest_data_date,
      freshnessDays: row.freshness_days || 0,
      coveragePct: parseFloat(row.coverage_pct) || 0,
      coverageDelta: parseFloat(row.coverage_delta) || 0,
      durationMs: row.duration_ms || 0,
      errorMessage: row.error_message,
    }));

    return {
      runId,
      pipelineName: run?.source || 'unknown',
      details,
      summary: {
        totalMetrics: details.length,
        succeeded: details.filter((d) => d.status === 'success').length,
        failed: details.filter((d) => d.status === 'failed').length,
        skipped: details.filter((d) => d.status === 'skipped').length,
      },
    };
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
