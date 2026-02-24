/**
 * Pipeline Runs Service
 *
 * Retrieves recent ETL pipeline runs from the data_ingestion_log table,
 * records pipeline status reports from import scripts, and triggers
 * pipeline runs via GitHub Actions workflow dispatch.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { PipelineStatusDto } from './dto/pipeline-status.dto';

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

  /**
   * Record a pipeline status report from import-reporter.ts.
   *
   * Inserts one row per geography in the data_ingestion_log table,
   * matching the schema used by the IngestionLogger in scripts/.
   */
  async recordPipelineStatus(
    report: PipelineStatusDto,
  ): Promise<{ recorded: number; errors: string[] }> {
    const client = this.supabase.getClient();
    const completedAt = report.timestamp || new Date().toISOString();
    const insertErrors: string[] = [];
    let recordedCount = 0;

    for (const geo of report.geographies) {
      try {
        const { error } = await client.from('data_ingestion_log').insert({
          source: report.source,
          table_name: geo.table,
          status: geo.status,
          records_processed: geo.inserted + geo.failed,
          records_success: geo.inserted,
          records_error: geo.failed,
          started_at: completedAt,
          completed_at: completedAt,
          duration_ms: report.durationMs,
        });

        if (error) {
          const errorMsg = `Failed to insert log for ${geo.id}/${geo.table}: ${error.message}`;
          this.logger.warn(errorMsg);
          insertErrors.push(errorMsg);
        } else {
          recordedCount++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const errorMsg = `Exception inserting log for ${geo.id}/${geo.table}: ${message}`;
        this.logger.error(errorMsg);
        insertErrors.push(errorMsg);
      }
    }

    this.logger.log(
      `Pipeline status recorded for ${report.source}: ${recordedCount}/${report.geographies.length} geographies`,
    );

    return { recorded: recordedCount, errors: insertErrors };
  }

  /**
   * Trigger a pipeline run via GitHub Actions workflow dispatch.
   *
   * Requires GITHUB_TOKEN and GITHUB_REPO (owner/repo format) env vars.
   * Returns an error message if env vars are not configured (does not crash).
   */
  async triggerPipeline(pipelineName: string): Promise<{ success: boolean; message: string }> {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;

    if (!githubToken || !githubRepo) {
      this.logger.warn(
        `Pipeline trigger for ${pipelineName} skipped: GITHUB_TOKEN or GITHUB_REPO not configured`,
      );
      return {
        success: false,
        message: 'GitHub token or repo not configured — cannot dispatch workflow',
      };
    }

    const [owner, repoName] = githubRepo.split('/');
    if (!owner || !repoName) {
      return {
        success: false,
        message: 'GITHUB_REPO must be in "owner/repo" format',
      };
    }

    const workflowUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/data-pipeline-cycle.yml/dispatches`;

    try {
      const response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { sources: pipelineName },
        }),
      });

      if (response.ok || response.status === 204) {
        this.logger.log(`Pipeline ${pipelineName} triggered via GitHub Actions`);
        return { success: true, message: `Pipeline ${pipelineName} triggered` };
      }

      const statusText = `GitHub API returned ${response.status}: ${response.statusText}`;
      this.logger.warn(`Pipeline trigger failed: ${statusText}`);
      return { success: false, message: statusText };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pipeline trigger error: ${message}`);
      return { success: false, message: `GitHub API request failed: ${message}` };
    }
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
