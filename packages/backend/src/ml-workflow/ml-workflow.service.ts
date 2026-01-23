/**
 * ML Workflow Service
 *
 * Manages PropertyIQ ML workflow execution:
 * - Calls the PropertyIQ Analytics microservice for scoring/backtesting
 * - Tracks job status in database
 * - Handles async job execution
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface StepState {
  status: StepStatus;
  lastRunTime: string | null;
  progress?: number;
  error?: string;
  jobId?: string;
}

export interface JobRecord {
  id: string;
  job_type: string;
  config: Record<string, unknown>;
  status: string;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Map step IDs to analytics API endpoints
const STEP_ENDPOINTS: Record<string, { method: string; path: string }> = {
  'score-homeready': { method: 'POST', path: '/api/v1/score/homeready' },
  'score-investor-edge': { method: 'POST', path: '/api/v1/score/investor-edge' },
  'backtest-run': { method: 'POST', path: '/api/v1/backtest/run' },
};

// Legacy step IDs that are no longer supported (were Python scripts)
const LEGACY_STEPS = [
  'data-export',
  'prepare-backtest-data',
  'calculate-benchmarks',
  'feature-analysis',
  'score-explanations',
  'monthly-report',
];

@Injectable()
export class MLWorkflowService {
  private readonly logger = new Logger(MLWorkflowService.name);
  private readonly analyticsServiceUrl: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.analyticsServiceUrl =
      this.configService.get<string>('ANALYTICS_SERVICE_URL') ||
      'http://localhost:8000';
    this.logger.log(`Analytics service URL: ${this.analyticsServiceUrl}`);
  }

  /**
   * Get current status of all workflow steps.
   */
  async getWorkflowStatus(): Promise<Record<string, StepState>> {
    const supabase = this.supabaseService.getClient();

    const allStepIds = [...Object.keys(STEP_ENDPOINTS), ...LEGACY_STEPS];

    const { data: jobs, error } = await supabase
      .from('propertyiq_ml_jobs')
      .select('*')
      .in('job_type', allStepIds)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch job status: ${error.message}`);
      throw error;
    }

    const stepStates: Record<string, StepState> = {};
    const seenSteps = new Set<string>();

    for (const job of jobs || []) {
      if (seenSteps.has(job.job_type)) continue;
      seenSteps.add(job.job_type);

      const uiStatus = this.mapDbStatusToUiStatus(job.status);

      stepStates[job.job_type] = {
        status: uiStatus,
        lastRunTime: job.completed_at || job.created_at,
        progress: job.progress,
        error: job.error,
        jobId: job.id,
      };
    }

    // Add pending state for steps with no jobs
    for (const stepId of Object.keys(STEP_ENDPOINTS)) {
      if (!stepStates[stepId]) {
        stepStates[stepId] = {
          status: 'pending',
          lastRunTime: null,
        };
      }
    }

    return stepStates;
  }

  /**
   * Map database status to UI status.
   */
  private mapDbStatusToUiStatus(dbStatus: string): StepStatus {
    switch (dbStatus) {
      case 'queued':
        return 'pending';
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'error';
      default:
        return 'pending';
    }
  }

  /**
   * Run a specific workflow step by calling the analytics service.
   */
  async runStep(
    stepId: string,
    payload?: Record<string, unknown>,
  ): Promise<{ jobId: string }> {
    // Check if it's a legacy step
    if (LEGACY_STEPS.includes(stepId)) {
      throw new Error(
        `Step "${stepId}" is no longer supported. Use the analytics service endpoints directly.`,
      );
    }

    const endpoint = STEP_ENDPOINTS[stepId];
    if (!endpoint) {
      throw new Error(`Unknown step: ${stepId}`);
    }

    const supabase = this.supabaseService.getClient();
    const jobId = crypto.randomUUID();

    // Create job record
    const { error: insertError } = await supabase
      .from('propertyiq_ml_jobs')
      .insert({
        id: jobId,
        job_type: stepId,
        config: payload || {},
        status: 'running',
        progress: 0,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      this.logger.error(`Failed to create job record: ${insertError.message}`);
      throw insertError;
    }

    // Call analytics service asynchronously
    this.executeAnalyticsCall(jobId, stepId, endpoint, payload);

    return { jobId };
  }

  /**
   * Execute the analytics service call and update job status.
   */
  private async executeAnalyticsCall(
    jobId: string,
    stepId: string,
    endpoint: { method: string; path: string },
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.analyticsServiceUrl}${endpoint.path}`;

    try {
      this.logger.log(`Calling analytics service: ${endpoint.method} ${url}`);

      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analytics service error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // Update job as completed
      await this.updateJobStatus(jobId, 'completed', null, result);
      this.logger.log(`[${stepId}] completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.updateJobStatus(jobId, 'error', errorMessage);
      this.logger.error(`[${stepId}] failed: ${errorMessage}`);
    }
  }

  /**
   * Calculate HomeReady score via analytics service.
   */
  async calculateHomeReadyScore(
    propertyData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.analyticsServiceUrl}/api/v1/score/homeready`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HomeReady scoring failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Calculate InvestorEdge score via analytics service.
   */
  async calculateInvestorEdgeScore(
    propertyData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.analyticsServiceUrl}/api/v1/score/investor-edge`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`InvestorEdge scoring failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Run backtest via analytics service.
   */
  async runBacktest(
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.analyticsServiceUrl}/api/v1/backtest/run`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backtest failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get status of a specific job.
   */
  async getJobStatus(jobId: string): Promise<JobRecord | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('propertyiq_ml_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as JobRecord;
  }

  /**
   * Check analytics service health.
   */
  async checkAnalyticsHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.analyticsServiceUrl}/api/v1/health`,
        { method: 'GET' },
      );

      if (response.ok) {
        return { healthy: true };
      }

      return { healthy: false, error: `Status ${response.status}` };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Update job status.
   */
  private async updateJobStatus(
    jobId: string,
    status: 'completed' | 'error',
    error?: string | null,
    result?: Record<string, unknown>,
  ) {
    const supabase = this.supabaseService.getClient();

    const dbStatus = status === 'error' ? 'failed' : status;

    const update: Record<string, unknown> = {
      status: dbStatus,
      completed_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      update.progress = 100;
    }

    if (error) {
      update.error = error;
    }

    if (result) {
      update.result = result;
    }

    await supabase.from('propertyiq_ml_jobs').update(update).eq('id', jobId);
  }
}
