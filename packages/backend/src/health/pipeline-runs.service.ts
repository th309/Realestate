/**
 * Pipeline Runs Service
 *
 * Retrieves recent ETL pipeline runs from the data_ingestion_log table.
 */

import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
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

  async triggerPipeline(
    pipelineName: string,
    filters?: Record<string, string[]>,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Pipeline trigger requested: ${pipelineName}, filters: ${JSON.stringify(filters)}`);

    const commands = this.buildPipelineCommands(pipelineName, filters);
    if (commands.length === 0) {
      return { success: false, message: `Unknown pipeline: ${pipelineName}` };
    }

    const filterSummary = filters
      ? Object.entries(filters).map(([k, v]) => `${k}=${v.join(',')}`).join('; ')
      : 'all';

    // Spawn scripts in background — each script creates its own ingestion log entry
    this.spawnScriptsInBackground(commands, pipelineName);

    return {
      success: true,
      message: `Pipeline ${pipelineName} triggered (${filterSummary})`,
    };
  }

  private buildPipelineCommands(
    pipelineName: string,
    filters?: Record<string, string[]>,
  ): { script: string; args: string[] }[] {
    const scriptsRoot = path.resolve(__dirname, '..', '..', '..', '..', 'scripts');

    switch (pipelineName) {
      case 'zillow': {
        const args: string[] = [];
        for (const m of filters?.metric || []) args.push(`--filter=${m}`);
        for (const g of filters?.geography || []) args.push(`--filter=${g}`);
        return [{ script: path.join(scriptsRoot, 'ingest-all-zillow-clean.ts'), args }];
      }

      case 'realtor': {
        const args = (filters?.geography || []).map((g) => `--geo=${g}`);
        return [{ script: path.join(scriptsRoot, 'import-realtor-data.ts'), args }];
      }

      case 'redfin': {
        const args = (filters?.geography || []).map((g) => `--geo=${g}`);
        return [{ script: path.join(scriptsRoot, 'redfin-sales-import', 'import-redfin-sales.ts'), args }];
      }

      case 'census_acs': {
        const args = (filters?.geography || []).map((g) => `--geo=${g}`);
        return [{ script: path.join(scriptsRoot, 'import-census-data.ts'), args }];
      }

      case 'bls':
      case 'fred': {
        const args = (filters?.geography || []).map((g) => `--geo=${g}`);
        return [{ script: path.join(scriptsRoot, 'import-economic-data.ts'), args }];
      }

      case 'hud_fmr':
        return [{ script: path.join(scriptsRoot, 'import-hud-fmr.ts'), args: [] }];

      case 'building_permits': {
        const args = (filters?.geography || []).map((g) => `--geo=${g}`);
        return [{ script: path.join(scriptsRoot, 'import-building-permits.ts'), args }];
      }

      default:
        return [];
    }
  }

  private async spawnScriptsInBackground(
    commands: { script: string; args: string[] }[],
    pipelineName: string,
  ): Promise<void> {
    for (const cmd of commands) {
      try {
        const result = await this.spawnScript(cmd.script, cmd.args);
        if (result.exitCode === 0) {
          this.logger.log(`Script completed for ${pipelineName}: ${cmd.script}`);
        } else {
          this.logger.error(
            `Script exited with code ${result.exitCode} for ${pipelineName}: ${result.stderr.slice(-500)}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Script spawn failed for ${pipelineName}: ${msg}`);
      }
    }
  }

  private spawnScript(
    scriptPath: string,
    args: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      this.logger.log(`Spawning: npx tsx ${scriptPath} ${args.join(' ')}`);

      const child = spawn('npx', ['tsx', scriptPath, ...args], {
        cwd: path.resolve(__dirname, '..', '..', '..', '..'),
        env: { ...process.env },
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        // Log last line for progress visibility
        const lines = text.trim().split('\n');
        if (lines.length > 0) {
          this.logger.debug(`[stdout] ${lines[lines.length - 1].slice(0, 200)}`);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        this.logger.warn(`[stderr] ${text.slice(0, 200)}`);
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });
    });
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
