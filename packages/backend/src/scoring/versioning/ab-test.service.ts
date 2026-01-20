/**
 * A/B Test Service
 *
 * Manages A/B tests for formula versions.
 * Supports traffic splitting, result tracking, and statistical analysis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { FormulaVersionService } from './formula-version.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import { v4 as uuidv4 } from 'uuid';

export interface ABTest {
  id: string;
  name: string;
  scoreType: ScoreType;
  controlVersion: string;
  treatmentVersion: string;
  trafficPercentage: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'rolled_back';
  startedAt: string | null;
  endedAt: string | null;
  createdBy: string | null;
  hypothesis: string | null;
  minSampleSize: number;
  minDurationDays: number;
}

export interface ABTestResult {
  testId: string;
  geographyType: GeographyType;
  geographyId: string;
  controlScore: number | null;
  treatmentScore: number | null;
  recordedAt: string;
}

export interface ABTestAnalysis {
  testId: string;
  sampleSize: number;
  controlMean: number;
  treatmentMean: number;
  controlStdDev: number;
  treatmentStdDev: number;
  difference: number;
  percentChange: number;
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: { lower: number; upper: number };
  recommendation: 'adopt_treatment' | 'keep_control' | 'continue_testing';
}

export interface CreateABTestInput {
  name: string;
  scoreType: ScoreType;
  controlVersion: string;
  treatmentVersion: string;
  trafficPercentage?: number;
  createdBy?: string;
  hypothesis?: string;
  minSampleSize?: number;
  minDurationDays?: number;
}

@Injectable()
export class ABTestService {
  private readonly logger = new Logger(ABTestService.name);
  private readonly DEFAULT_TRAFFIC_PERCENTAGE = 10;
  private readonly DEFAULT_MIN_SAMPLE_SIZE = 1000;
  private readonly DEFAULT_MIN_DURATION_DAYS = 30;
  private readonly SIGNIFICANCE_THRESHOLD = 0.05;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly formulaVersionService: FormulaVersionService,
  ) {}

  /**
   * Create a new A/B test
   */
  async createTest(input: CreateABTestInput): Promise<ABTest> {
    const client = this.supabase.getClient();

    // Validate versions exist
    const control = await this.formulaVersionService.getVersion(
      input.controlVersion,
      input.scoreType,
    );
    const treatment = await this.formulaVersionService.getVersion(
      input.treatmentVersion,
      input.scoreType,
    );

    if (!control || !treatment) {
      throw new Error('Control or treatment version not found');
    }

    const testId = uuidv4();

    const { data, error } = await client
      .from('propertyiq_ab_tests')
      .insert({
        id: testId,
        name: input.name,
        score_type: input.scoreType,
        control_version: input.controlVersion,
        treatment_version: input.treatmentVersion,
        traffic_percentage: input.trafficPercentage || this.DEFAULT_TRAFFIC_PERCENTAGE,
        status: 'draft',
        created_by: input.createdBy,
        hypothesis: input.hypothesis,
        min_sample_size: input.minSampleSize || this.DEFAULT_MIN_SAMPLE_SIZE,
        min_duration_days: input.minDurationDays || this.DEFAULT_MIN_DURATION_DAYS,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Error creating A/B test: ${error?.message}`);
      throw new Error(`Failed to create A/B test: ${error?.message}`);
    }

    this.logger.log(`Created A/B test ${testId}: ${input.name}`);

    return this.mapDbToTest(data);
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('propertyiq_ab_tests')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', testId)
      .eq('status', 'draft');

    if (error) {
      this.logger.error(`Error starting test ${testId}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Started A/B test ${testId}`);
  }

  /**
   * Pause a running A/B test
   */
  async pauseTest(testId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('propertyiq_ab_tests')
      .update({ status: 'paused' })
      .eq('id', testId)
      .eq('status', 'running');

    if (error) {
      this.logger.error(`Error pausing test ${testId}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Paused A/B test ${testId}`);
  }

  /**
   * Resume a paused A/B test
   */
  async resumeTest(testId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('propertyiq_ab_tests')
      .update({ status: 'running' })
      .eq('id', testId)
      .eq('status', 'paused');

    if (error) {
      this.logger.error(`Error resuming test ${testId}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Resumed A/B test ${testId}`);
  }

  /**
   * Complete an A/B test and optionally adopt treatment
   */
  async completeTest(testId: string, adoptTreatment: boolean): Promise<void> {
    const client = this.supabase.getClient();
    const test = await this.getTest(testId);

    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const { error } = await client
      .from('propertyiq_ab_tests')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', testId);

    if (error) {
      this.logger.error(`Error completing test ${testId}: ${error.message}`);
      throw error;
    }

    if (adoptTreatment) {
      await this.formulaVersionService.activateVersion(test.treatmentVersion, test.scoreType);
      this.logger.log(`Adopted treatment version ${test.treatmentVersion}`);
    }

    this.logger.log(`Completed A/B test ${testId}, adoptTreatment=${adoptTreatment}`);
  }

  /**
   * Rollback a test (revert to control)
   */
  async rollbackTest(testId: string): Promise<void> {
    const client = this.supabase.getClient();
    const test = await this.getTest(testId);

    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const { error } = await client
      .from('propertyiq_ab_tests')
      .update({
        status: 'rolled_back',
        ended_at: new Date().toISOString(),
      })
      .eq('id', testId);

    if (error) {
      this.logger.error(`Error rolling back test ${testId}: ${error.message}`);
      throw error;
    }

    await this.formulaVersionService.activateVersion(test.controlVersion, test.scoreType);

    this.logger.log(`Rolled back A/B test ${testId} to control version`);
  }

  /**
   * Get a specific A/B test
   */
  async getTest(testId: string): Promise<ABTest | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !data) return null;

    return this.mapDbToTest(data);
  }

  /**
   * Get all A/B tests for a score type
   */
  async getTestsForScoreType(scoreType: ScoreType): Promise<ABTest[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_ab_tests')
      .select('*')
      .eq('score_type', scoreType)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapDbToTest);
  }

  /**
   * Get active test for a score type (if any)
   */
  async getActiveTest(scoreType: ScoreType): Promise<ABTest | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_ab_tests')
      .select('*')
      .eq('score_type', scoreType)
      .eq('status', 'running')
      .single();

    if (error || !data) return null;

    return this.mapDbToTest(data);
  }

  /**
   * Determine which version to use for a calculation
   */
  async getVersionForCalculation(
    scoreType: ScoreType,
    geographyId: string,
  ): Promise<{ version: string; isControl: boolean; testId: string | null }> {
    const activeTest = await this.getActiveTest(scoreType);

    if (!activeTest) {
      const activeVersion = await this.formulaVersionService.getActiveVersion(scoreType);
      return {
        version: activeVersion?.version || '1.0.0',
        isControl: true,
        testId: null,
      };
    }

    // Deterministic assignment based on geography ID
    const hash = this.hashString(geographyId);
    const bucket = hash % 100;
    const isControl = bucket >= activeTest.trafficPercentage;

    return {
      version: isControl ? activeTest.controlVersion : activeTest.treatmentVersion,
      isControl,
      testId: activeTest.id,
    };
  }

  /**
   * Record a test result
   */
  async recordResult(
    testId: string,
    geographyType: GeographyType,
    geographyId: string,
    controlScore: number | null,
    treatmentScore: number | null,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client.from('propertyiq_ab_test_results').insert({
      test_id: testId,
      geography_type: geographyType,
      geography_id: geographyId,
      control_score: controlScore,
      treatment_score: treatmentScore,
    });

    if (error) {
      this.logger.error(`Error recording test result: ${error.message}`);
    }
  }

  /**
   * Analyze A/B test results
   */
  async analyzeTest(testId: string): Promise<ABTestAnalysis> {
    const client = this.supabase.getClient();
    const test = await this.getTest(testId);

    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    // Get all results
    const { data: results, error } = await client
      .from('propertyiq_ab_test_results')
      .select('control_score, treatment_score')
      .eq('test_id', testId)
      .not('control_score', 'is', null)
      .not('treatment_score', 'is', null);

    if (error || !results || results.length === 0) {
      throw new Error('Insufficient data for analysis');
    }

    const controlScores = results.map((r) => r.control_score as number);
    const treatmentScores = results.map((r) => r.treatment_score as number);

    // Calculate statistics
    const controlMean = this.mean(controlScores);
    const treatmentMean = this.mean(treatmentScores);
    const controlStdDev = this.stdDev(controlScores, controlMean);
    const treatmentStdDev = this.stdDev(treatmentScores, treatmentMean);

    const difference = treatmentMean - controlMean;
    const percentChange = controlMean !== 0 ? (difference / controlMean) * 100 : 0;

    // Two-sample t-test
    const { tStatistic, pValue } = this.twoSampleTTest(
      controlScores,
      treatmentScores,
      controlMean,
      treatmentMean,
      controlStdDev,
      treatmentStdDev,
    );

    const isSignificant = pValue < this.SIGNIFICANCE_THRESHOLD;

    // 95% confidence interval for difference
    const se = Math.sqrt(
      (controlStdDev ** 2) / controlScores.length +
        (treatmentStdDev ** 2) / treatmentScores.length,
    );
    const criticalValue = 1.96; // 95% CI
    const confidenceInterval = {
      lower: difference - criticalValue * se,
      upper: difference + criticalValue * se,
    };

    // Determine recommendation
    let recommendation: 'adopt_treatment' | 'keep_control' | 'continue_testing';

    if (!isSignificant) {
      recommendation = this.hasMinimumData(test, results.length)
        ? 'keep_control'
        : 'continue_testing';
    } else if (difference > 0) {
      recommendation = 'adopt_treatment';
    } else {
      recommendation = 'keep_control';
    }

    return {
      testId,
      sampleSize: results.length,
      controlMean,
      treatmentMean,
      controlStdDev,
      treatmentStdDev,
      difference,
      percentChange,
      tStatistic,
      pValue,
      isSignificant,
      confidenceInterval,
      recommendation,
    };
  }

  /**
   * Check if test should auto-rollback
   */
  async checkAutoRollback(testId: string): Promise<boolean> {
    try {
      const analysis = await this.analyzeTest(testId);

      // Auto-rollback if treatment is significantly worse
      if (analysis.isSignificant && analysis.difference < -5) {
        this.logger.warn(`Auto-rolling back test ${testId}: treatment significantly worse`);
        await this.rollbackTest(testId);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private mapDbToTest(row: Record<string, unknown>): ABTest {
    return {
      id: row.id as string,
      name: row.name as string,
      scoreType: row.score_type as ScoreType,
      controlVersion: row.control_version as string,
      treatmentVersion: row.treatment_version as string,
      trafficPercentage: row.traffic_percentage as number,
      status: row.status as ABTest['status'],
      startedAt: row.started_at as string | null,
      endedAt: row.ended_at as string | null,
      createdBy: row.created_by as string | null,
      hypothesis: row.hypothesis as string | null,
      minSampleSize: row.min_sample_size as number,
      minDurationDays: row.min_duration_days as number,
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
  }

  private twoSampleTTest(
    group1: number[],
    group2: number[],
    mean1: number,
    mean2: number,
    std1: number,
    std2: number,
  ): { tStatistic: number; pValue: number } {
    const n1 = group1.length;
    const n2 = group2.length;

    if (n1 < 2 || n2 < 2) {
      return { tStatistic: 0, pValue: 1 };
    }

    const se = Math.sqrt((std1 ** 2) / n1 + (std2 ** 2) / n2);

    if (se === 0) {
      return { tStatistic: 0, pValue: 1 };
    }

    const tStatistic = (mean1 - mean2) / se;

    // Welch's degrees of freedom
    const df =
      Math.pow((std1 ** 2) / n1 + (std2 ** 2) / n2, 2) /
      (Math.pow((std1 ** 2) / n1, 2) / (n1 - 1) + Math.pow((std2 ** 2) / n2, 2) / (n2 - 1));

    // Approximate p-value using normal distribution for large samples
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStatistic)));

    return { tStatistic, pValue };
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private hasMinimumData(test: ABTest, sampleSize: number): boolean {
    if (sampleSize < test.minSampleSize) return false;

    if (test.startedAt) {
      const startDate = new Date(test.startedAt);
      const daysSinceStart = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart < test.minDurationDays) return false;
    }

    return true;
  }
}
