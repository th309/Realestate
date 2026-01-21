/**
 * ML Validation Service
 *
 * Manages ML validation jobs that compare formula-based scores
 * against AutoGluon predictions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { randomUUID } from 'crypto';

export interface MLValidationConfig {
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  geographyType: 'metro' | 'county' | 'zip';
  horizon: '6m' | '1y' | '3y' | '5y';
  trainPeriodStart: string;
  trainPeriodEnd: string;
  testPeriodStart: string;
  testPeriodEnd: string;
  mlPreset: 'medium_quality' | 'best_quality' | 'high_quality';
  timeLimitSeconds: number;
}

export interface MLValidationResult {
  id: string;
  scoreType: string;
  geographyType: string;
  horizon: string;
  trainPeriodStart: string;
  trainPeriodEnd: string;
  testPeriodStart: string;
  testPeriodEnd: string;
  mlPreset: string;
  timeLimitSeconds: number;
  formulaR2: number | null;
  formulaDirectionalAccuracy: number | null;
  formulaMae: number | null;
  formulaRmse: number | null;
  formulaQuintileSpread: number | null;
  mlR2: number | null;
  mlDirectionalAccuracy: number | null;
  mlMae: number | null;
  mlRmse: number | null;
  mlQuintileSpread: number | null;
  featureImportance: FeatureImportance[];
  suggestedWeights: WeightSuggestion[];
  suggestedMetrics: MetricSuggestion[];
  subgroupAnalysis: SubgroupAnalysis[];
  mlLeaderboard: LeaderboardEntry[];
  trainingTimeSeconds: number | null;
  testSamples: number | null;
  featuresUsed: number | null;
  status: 'ok' | 'review' | 'action_required';
  createdAt: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  currentWeight: number | null;
  component: string | null;
  status: 'aligned' | 'missing' | 'overweight' | 'underweight';
}

export interface WeightSuggestion {
  component: string;
  currentWeight: number;
  suggestedWeight: number;
  change: number;
  rationale: string;
}

export interface MetricSuggestion {
  metric: string;
  mlImportance: number;
  suggestedComponent: string;
  rationale: string;
}

export interface SubgroupAnalysis {
  dimension: string;
  segments: {
    name: string;
    formulaR2: number;
    mlR2: number;
    gap: number;
    sampleSize: number;
    status: 'ok' | 'review' | 'action_required';
  }[];
}

export interface LeaderboardEntry {
  rank: number;
  model: string;
  score: number;
  predictTime: number;
  fitTime: number;
}

export interface JobStatus {
  id: string;
  jobType: string;
  config: MLValidationConfig;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result: { validationId?: string } | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

@Injectable()
export class MLValidationService {
  private readonly logger = new Logger(MLValidationService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Queue a new ML validation job.
   * The job will be picked up by a Python worker.
   */
  async queueMLValidationJob(config: MLValidationConfig): Promise<{ jobId: string }> {
    const jobId = randomUUID();

    const { error } = await this.supabase.client
      .from('propertyiq_ml_jobs')
      .insert({
        id: jobId,
        job_type: 'ml_validation',
        config: {
          score_type: config.scoreType,
          geography_type: config.geographyType,
          horizon: config.horizon,
          train_period_start: config.trainPeriodStart,
          train_period_end: config.trainPeriodEnd,
          test_period_start: config.testPeriodStart,
          test_period_end: config.testPeriodEnd,
          ml_preset: config.mlPreset,
          time_limit_seconds: config.timeLimitSeconds,
        },
        status: 'queued',
        progress: 0,
      });

    if (error) {
      this.logger.error(`Failed to queue ML validation job: ${error.message}`);
      throw new Error(`Failed to queue job: ${error.message}`);
    }

    this.logger.log(`Queued ML validation job ${jobId}`);

    // In production, this would trigger a Python worker
    // For now, we just return the job ID for polling
    this.triggerPythonWorker(jobId);

    return { jobId };
  }

  /**
   * Trigger the Python worker to process the job.
   * In production, this could use Redis pub/sub, AWS SQS, or similar.
   */
  private async triggerPythonWorker(jobId: string): Promise<void> {
    // This is a placeholder for the actual worker trigger mechanism
    // Options:
    // 1. Redis pub/sub to notify Python worker
    // 2. AWS Lambda/Cloud Run invocation
    // 3. Direct process spawn (dev only)

    this.logger.log(`Would trigger Python worker for job ${jobId}`);

    // For development, you can manually run:
    // python packages/backend/jobs/ml_validation_job.py --job-id <jobId>
  }

  /**
   * Get the status of an ML validation job.
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const { data, error } = await this.supabase.client
      .from('propertyiq_ml_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get job status: ${error.message}`);
    }

    return {
      id: data.id,
      jobType: data.job_type,
      config: {
        scoreType: data.config.score_type,
        geographyType: data.config.geography_type,
        horizon: data.config.horizon,
        trainPeriodStart: data.config.train_period_start,
        trainPeriodEnd: data.config.train_period_end,
        testPeriodStart: data.config.test_period_start,
        testPeriodEnd: data.config.test_period_end,
        mlPreset: data.config.ml_preset,
        timeLimitSeconds: data.config.time_limit_seconds,
      },
      status: data.status,
      progress: data.progress,
      result: data.result,
      error: data.error,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  }

  /**
   * List ML validation results.
   */
  async listValidations(params: {
    scoreType?: string;
    geographyType?: string;
    horizon?: string;
    limit?: number;
  }): Promise<MLValidationResult[]> {
    let query = this.supabase.client
      .from('propertyiq_ml_validations')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.scoreType) {
      query = query.eq('score_type', params.scoreType);
    }
    if (params.geographyType) {
      query = query.eq('geography_type', params.geographyType);
    }
    if (params.horizon) {
      query = query.eq('horizon', params.horizon);
    }

    query = query.limit(params.limit || 20);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list validations: ${error.message}`);
    }

    return (data || []).map(this.mapValidationResult);
  }

  /**
   * Get a specific ML validation result.
   */
  async getValidation(id: string): Promise<MLValidationResult | null> {
    const { data, error } = await this.supabase.client
      .from('propertyiq_ml_validations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get validation: ${error.message}`);
    }

    return this.mapValidationResult(data);
  }

  /**
   * Apply ML suggestions to create a draft formula version.
   */
  async applySuggestions(
    validationId: string,
    options: { applyWeights: boolean; applyMetrics: boolean },
  ): Promise<{ draftVersion: string }> {
    const validation = await this.getValidation(validationId);

    if (!validation) {
      throw new Error('Validation not found');
    }

    // This would integrate with FormulaVersionService to create a new draft
    // For now, return a placeholder

    this.logger.log(
      `Would apply suggestions from ${validationId}: weights=${options.applyWeights}, metrics=${options.applyMetrics}`,
    );

    // TODO: Integrate with FormulaVersionService
    // const currentFormula = await this.formulaVersionService.getActiveFormula(validation.scoreType);
    // const newFormula = this.applyMLSuggestions(currentFormula, validation, options);
    // const draft = await this.formulaVersionService.createVersion(...)

    return { draftVersion: '1.0.1-draft' };
  }

  /**
   * Map database row to MLValidationResult.
   */
  private mapValidationResult(row: Record<string, unknown>): MLValidationResult {
    return {
      id: row.id as string,
      scoreType: row.score_type as string,
      geographyType: row.geography_type as string,
      horizon: row.horizon as string,
      trainPeriodStart: row.train_period_start as string,
      trainPeriodEnd: row.train_period_end as string,
      testPeriodStart: row.test_period_start as string,
      testPeriodEnd: row.test_period_end as string,
      mlPreset: row.ml_preset as string,
      timeLimitSeconds: row.time_limit_seconds as number,
      formulaR2: row.formula_r2 as number | null,
      formulaDirectionalAccuracy: row.formula_directional_accuracy as number | null,
      formulaMae: row.formula_mae as number | null,
      formulaRmse: row.formula_rmse as number | null,
      formulaQuintileSpread: row.formula_quintile_spread as number | null,
      mlR2: row.ml_r2 as number | null,
      mlDirectionalAccuracy: row.ml_directional_accuracy as number | null,
      mlMae: row.ml_mae as number | null,
      mlRmse: row.ml_rmse as number | null,
      mlQuintileSpread: row.ml_quintile_spread as number | null,
      featureImportance: (row.feature_importance as FeatureImportance[]) || [],
      suggestedWeights: (row.suggested_weights as WeightSuggestion[]) || [],
      suggestedMetrics: (row.suggested_metrics as MetricSuggestion[]) || [],
      subgroupAnalysis: (row.subgroup_analysis as SubgroupAnalysis[]) || [],
      mlLeaderboard: (row.ml_leaderboard as LeaderboardEntry[]) || [],
      trainingTimeSeconds: row.training_time_seconds as number | null,
      testSamples: row.test_samples as number | null,
      featuresUsed: row.features_used as number | null,
      status: row.status as 'ok' | 'review' | 'action_required',
      createdAt: row.created_at as string,
    };
  }
}
