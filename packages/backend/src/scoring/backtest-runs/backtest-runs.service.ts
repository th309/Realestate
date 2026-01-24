/**
 * Backtest Runs Service
 *
 * Manages automated backtest runs and their results.
 * Provides methods for listing runs, viewing details, and triggering new runs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

export interface BacktestRunConfig {
  score_types: string[];
  horizons: string[];
  geography_types: string[];
  county_sample: number;
  city_sample: number;
  zip_sample: number;
  random_seed: number;
  lookback_months: number;
}

export interface BacktestMetrics {
  r2: number;
  directional_accuracy: number;
  mae: number;
  rmse: number;
  quintile_spread: number;
  sample_size: number;
}

export interface ConfidenceResult {
  confidence_score: number;
  status: string;
  r2_component: number;
  sample_component: number;
  recency_component: number;
}

export interface BacktestCellResult {
  score_type: string;
  horizon: string;
  geography_type: string;
  metrics: BacktestMetrics;
  confidence: ConfidenceResult;
}

export interface BacktestRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  config: BacktestRunConfig;
  total_geographies_tested: number;
  total_score_calculations: number;
  status: string;
  results: BacktestCellResult[];
  alert_count: number;
  created_at: string;
}

export interface BacktestSample {
  id: number;
  run_id: string;
  geography_type: string;
  sample_size: number;
  geography_ids: string[];
  sampling_method: string;
  strata_config: Record<string, unknown>;
  created_at: string;
}

export interface ListBacktestRunsParams {
  limit?: number;
  offset?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface TriggerBacktestParams {
  score_types?: string[];
  horizons?: string[];
  county_sample?: number;
  zip_sample?: number;
  random_seed?: number;
}

export interface TriggerResult {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
}

@Injectable()
export class BacktestRunsService {
  private readonly logger = new Logger(BacktestRunsService.name);
  private readonly analyticsServiceUrl: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.analyticsServiceUrl =
      this.configService.get<string>('ANALYTICS_SERVICE_URL') ||
      'http://localhost:8000';
  }

  /**
   * List recent backtest runs with optional filtering.
   */
  async listRuns(params: ListBacktestRunsParams = {}): Promise<{
    runs: BacktestRun[];
    total: number;
  }> {
    const { limit = 20, offset = 0, status, startDate, endDate } = params;

    let query = this.supabase.getClient()
      .from('propertyiq_backtest_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('started_at', startDate);
    }

    if (endDate) {
      query = query.lte('started_at', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to list backtest runs: ${error.message}`);
      throw new Error(`Failed to list backtest runs: ${error.message}`);
    }

    return {
      runs: data as BacktestRun[],
      total: count || 0,
    };
  }

  /**
   * Get a specific backtest run by ID.
   */
  async getRun(runId: string): Promise<BacktestRun | null> {
    const { data, error } = await this.supabase.getClient()
      .from('propertyiq_backtest_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to get backtest run: ${error.message}`);
      throw new Error(`Failed to get backtest run: ${error.message}`);
    }

    return data as BacktestRun;
  }

  /**
   * Get samples for a specific backtest run.
   */
  async getRunSamples(runId: string): Promise<BacktestSample[]> {
    const { data, error } = await this.supabase.getClient()
      .from('propertyiq_backtest_samples')
      .select('*')
      .eq('run_id', runId)
      .order('geography_type');

    if (error) {
      this.logger.error(`Failed to get backtest samples: ${error.message}`);
      throw new Error(`Failed to get backtest samples: ${error.message}`);
    }

    return data as BacktestSample[];
  }

  /**
   * Get confidence summary across all recent runs.
   * Returns the latest confidence for each score/horizon/geography combination.
   */
  async getConfidenceSummary(): Promise<Record<string, Record<string, Record<string, ConfidenceResult>>>> {
    // Get the most recent run
    const { data: latestRun, error } = await this.supabase.getClient()
      .from('propertyiq_backtest_runs')
      .select('results')
      .eq('status', 'healthy')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestRun) {
      this.logger.warn('No healthy backtest runs found');
      return {};
    }

    // Build nested structure: score_type -> horizon -> geography_type -> confidence
    const summary: Record<string, Record<string, Record<string, ConfidenceResult>>> = {};

    for (const result of latestRun.results as BacktestCellResult[]) {
      if (!summary[result.score_type]) {
        summary[result.score_type] = {};
      }
      if (!summary[result.score_type][result.horizon]) {
        summary[result.score_type][result.horizon] = {};
      }
      summary[result.score_type][result.horizon][result.geography_type] = result.confidence;
    }

    return summary;
  }

  /**
   * Get confidence trend over time for a specific combination.
   */
  async getConfidenceTrend(
    scoreType: string,
    horizon: string,
    geographyType: string,
    months: number = 12,
  ): Promise<Array<{ date: string; confidence: number; status: string }>> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await this.supabase.getClient()
      .from('propertyiq_backtest_runs')
      .select('started_at, results')
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get confidence trend: ${error.message}`);
      throw new Error(`Failed to get confidence trend: ${error.message}`);
    }

    const trend: Array<{ date: string; confidence: number; status: string }> = [];

    for (const run of data || []) {
      const results = run.results as BacktestCellResult[];
      const cell = results.find(
        r =>
          r.score_type === scoreType &&
          r.horizon === horizon &&
          r.geography_type === geographyType,
      );

      if (cell) {
        trend.push({
          date: run.started_at,
          confidence: cell.confidence.confidence_score,
          status: cell.confidence.status,
        });
      }
    }

    return trend;
  }

  /**
   * Trigger a new backtest run via the analytics service.
   */
  async triggerBacktest(params: TriggerBacktestParams = {}): Promise<TriggerResult> {
    const {
      score_types = ['market_health', 'homeready', 'investoredge'],
      horizons = ['6m', '1y', '3y', '5y'],
      county_sample = 500,
      zip_sample = 2000,
      random_seed = 42,
    } = params;

    // Create a job entry
    const jobId = `backtest_${Date.now()}`;

    const { error: insertError } = await this.supabase.getClient()
      .from('propertyiq_ml_jobs')
      .insert({
        id: jobId,
        job_type: 'automated_backtest',
        config: {
          score_types,
          horizons,
          county_sample,
          zip_sample,
          random_seed,
        },
        status: 'running',
        progress: 0,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      this.logger.error(`Failed to create backtest job: ${insertError.message}`);
      throw new Error(`Failed to create backtest job: ${insertError.message}`);
    }

    // Call analytics service asynchronously
    this.executeBacktestCall(jobId, {
      score_types,
      horizons,
      county_sample,
      zip_sample,
      random_seed,
    });

    this.logger.log(`Triggered backtest job: ${jobId}`);

    return {
      jobId,
      status: 'running',
      message: 'Backtest job started successfully',
    };
  }

  /**
   * Execute backtest via analytics service and update job status.
   */
  private async executeBacktestCall(
    jobId: string,
    params: {
      score_types: string[];
      horizons: string[];
      county_sample: number;
      zip_sample: number;
      random_seed: number;
    },
  ): Promise<void> {
    const url = `${this.analyticsServiceUrl}/api/v1/backtest/run`;

    try {
      this.logger.log(`Calling analytics service: POST ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analytics service error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // Update job as completed
      await this.supabase.getClient()
        .from('propertyiq_ml_jobs')
        .update({
          status: 'completed',
          progress: 100,
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      this.logger.log(`Backtest job ${jobId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.supabase.getClient()
        .from('propertyiq_ml_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      this.logger.error(`Backtest job ${jobId} failed: ${errorMessage}`);
    }
  }

  /**
   * Get the status of a backtest job.
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    error?: string;
    result?: unknown;
  } | null> {
    const { data, error } = await this.supabase.getClient()
      .from('propertyiq_ml_jobs')
      .select('status, progress, error, result')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get job status: ${error.message}`);
    }

    return data;
  }

  /**
   * Get run statistics for the dashboard.
   */
  async getRunStatistics(): Promise<{
    totalRuns: number;
    lastRunDate: string | null;
    averageDuration: number;
    statusCounts: Record<string, number>;
  }> {
    const { data, error } = await this.supabase.getClient()
      .from('propertyiq_backtest_runs')
      .select('status, duration_seconds, started_at')
      .order('started_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get run statistics: ${error.message}`);
    }

    const runs = data || [];
    const statusCounts: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const run of runs) {
      statusCounts[run.status] = (statusCounts[run.status] || 0) + 1;
      if (run.duration_seconds) {
        totalDuration += run.duration_seconds;
        durationCount++;
      }
    }

    return {
      totalRuns: runs.length,
      lastRunDate: runs.length > 0 ? runs[0].started_at : null,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      statusCounts,
    };
  }
}
