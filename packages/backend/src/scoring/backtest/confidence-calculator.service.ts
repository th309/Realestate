/**
 * Confidence Calculator Service
 *
 * Calculates confidence scores based on backtest results.
 * Formula: Confidence = (R² × 0.5) + (Sample Size Score × 0.3) + (Recency Score × 0.2)
 *
 * Thresholds:
 * - 70%+ = Healthy (high confidence)
 * - 55-69% = Monitor (medium confidence)
 * - 40-54% = Review (low confidence)
 * - <40% = Broken
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import type { BacktestResult } from './backtest-runner.service';

export interface ConfidenceScore {
  scoreType: ScoreType;
  geographyType: GeographyType;
  formulaVersion: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low' | 'broken';
  status: 'healthy' | 'monitor' | 'review' | 'broken';
  correlationScore: number;
  sampleSizeScore: number;
  recencyScore: number;
  lastBacktestDate: string;
  sampleCount: number;
  rSquared: number | null;
}

// Thresholds for confidence levels
const CONFIDENCE_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 55,
  LOW: 40,
};

// Target sample sizes for full confidence
const SAMPLE_SIZE_TARGETS = {
  state: 50,
  metro: 200,
  county: 500,
  city: 1000,
  zip: 2000,
  national: 1,
};

@Injectable()
export class ConfidenceCalculatorService {
  private readonly logger = new Logger(ConfidenceCalculatorService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Calculate confidence from backtest results
   */
  calculateConfidence(
    results: BacktestResult[],
    scoreType: ScoreType,
    geographyType: GeographyType,
    formulaVersion: string,
  ): ConfidenceScore {
    // Filter results for this score/geography type
    const relevantResults = results.filter(
      (r) =>
        r.scoreType === scoreType &&
        r.geographyType === geographyType &&
        r.formulaVersion === formulaVersion,
    );

    if (relevantResults.length === 0) {
      return this.createEmptyConfidence(scoreType, geographyType, formulaVersion);
    }

    // Use the most recent result (typically 1-year horizon as primary)
    const primaryResult =
      relevantResults.find((r) => r.outcomeHorizon === '1y') || relevantResults[0];

    // Calculate component scores
    const correlationScore = this.calculateCorrelationScore(primaryResult.rSquared);
    const sampleSizeScore = this.calculateSampleSizeScore(
      primaryResult.sampleCount,
      geographyType,
    );
    const recencyScore = this.calculateRecencyScore(primaryResult.backtestEndDate);

    // Weighted combination
    const confidenceScore =
      correlationScore * 0.5 + sampleSizeScore * 0.3 + recencyScore * 0.2;

    // Determine level and status
    const { level, status } = this.determineConfidenceLevel(confidenceScore);

    return {
      scoreType,
      geographyType,
      formulaVersion,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      confidenceLevel: level,
      status,
      correlationScore: Math.round(correlationScore * 100) / 100,
      sampleSizeScore: Math.round(sampleSizeScore * 100) / 100,
      recencyScore: Math.round(recencyScore * 100) / 100,
      lastBacktestDate: primaryResult.backtestEndDate,
      sampleCount: primaryResult.sampleCount,
      rSquared: primaryResult.rSquared,
    };
  }

  /**
   * Update confidence in database
   */
  async updateConfidence(confidence: ConfidenceScore): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client.from('propertyiq_confidence').upsert(
      {
        score_type: confidence.scoreType,
        geography_type: confidence.geographyType,
        formula_version: confidence.formulaVersion,
        confidence_score: confidence.confidenceScore,
        confidence_level: confidence.confidenceLevel,
        status: confidence.status,
        correlation_score: confidence.correlationScore,
        sample_size_score: confidence.sampleSizeScore,
        recency_score: confidence.recencyScore,
        last_backtest_date: confidence.lastBacktestDate,
        sample_count: confidence.sampleCount,
        r_squared: confidence.rSquared,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'score_type,geography_type,formula_version' },
    );

    if (error) {
      this.logger.error(`Error updating confidence: ${error.message}`);
      throw error;
    }

    this.logger.log(
      `Updated confidence for ${confidence.scoreType}/${confidence.geographyType}: ${confidence.confidenceScore}% (${confidence.status})`,
    );
  }

  /**
   * Get current confidence for a score/geography type
   */
  async getConfidence(
    scoreType: ScoreType,
    geographyType: GeographyType,
  ): Promise<ConfidenceScore | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_confidence')
      .select('*')
      .eq('score_type', scoreType)
      .eq('geography_type', geographyType)
      .single();

    if (error || !data) return null;

    return {
      scoreType: data.score_type as ScoreType,
      geographyType: data.geography_type as GeographyType,
      formulaVersion: data.formula_version,
      confidenceScore: data.confidence_score,
      confidenceLevel: data.confidence_level as 'high' | 'medium' | 'low' | 'broken',
      status: data.status as 'healthy' | 'monitor' | 'review' | 'broken',
      correlationScore: data.correlation_score,
      sampleSizeScore: data.sample_size_score,
      recencyScore: data.recency_score,
      lastBacktestDate: data.last_backtest_date,
      sampleCount: data.sample_count,
      rSquared: data.r_squared,
    };
  }

  /**
   * Get all confidence scores
   */
  async getAllConfidence(): Promise<ConfidenceScore[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_confidence')
      .select('*')
      .order('score_type')
      .order('geography_type');

    if (error || !data) return [];

    return data.map((d) => ({
      scoreType: d.score_type as ScoreType,
      geographyType: d.geography_type as GeographyType,
      formulaVersion: d.formula_version,
      confidenceScore: d.confidence_score,
      confidenceLevel: d.confidence_level as 'high' | 'medium' | 'low' | 'broken',
      status: d.status as 'healthy' | 'monitor' | 'review' | 'broken',
      correlationScore: d.correlation_score,
      sampleSizeScore: d.sample_size_score,
      recencyScore: d.recency_score,
      lastBacktestDate: d.last_backtest_date,
      sampleCount: d.sample_count,
      rSquared: d.r_squared,
    }));
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private calculateCorrelationScore(rSquared: number | null): number {
    if (rSquared === null) return 0;

    // R² of 0.5 = 100% correlation score
    // R² of 0 = 0% correlation score
    // Scale: (R² / 0.5) * 100, capped at 100
    return Math.min(100, (rSquared / 0.5) * 100);
  }

  private calculateSampleSizeScore(sampleCount: number, geographyType: GeographyType): number {
    const target = SAMPLE_SIZE_TARGETS[geographyType] || 100;

    // Logarithmic scaling to prevent over-weighting large samples
    // At target = 100%, at 10x target still ~115%
    const ratio = sampleCount / target;

    if (ratio >= 1) {
      // Above target: diminishing returns
      return Math.min(100, 80 + 20 * Math.log10(ratio + 1));
    } else {
      // Below target: linear scaling
      return ratio * 80;
    }
  }

  private calculateRecencyScore(backtestEndDate: string): number {
    const endDate = new Date(backtestEndDate);
    const now = new Date();
    const daysSince = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);

    // Full score if within 30 days
    // 50% score at 90 days
    // 0% score at 180 days
    if (daysSince <= 30) return 100;
    if (daysSince >= 180) return 0;

    return Math.max(0, 100 - ((daysSince - 30) / 150) * 100);
  }

  private determineConfidenceLevel(score: number): {
    level: 'high' | 'medium' | 'low' | 'broken';
    status: 'healthy' | 'monitor' | 'review' | 'broken';
  } {
    if (score >= CONFIDENCE_THRESHOLDS.HIGH) {
      return { level: 'high', status: 'healthy' };
    }
    if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return { level: 'medium', status: 'monitor' };
    }
    if (score >= CONFIDENCE_THRESHOLDS.LOW) {
      return { level: 'low', status: 'review' };
    }
    return { level: 'broken', status: 'broken' };
  }

  private createEmptyConfidence(
    scoreType: ScoreType,
    geographyType: GeographyType,
    formulaVersion: string,
  ): ConfidenceScore {
    return {
      scoreType,
      geographyType,
      formulaVersion,
      confidenceScore: 0,
      confidenceLevel: 'broken',
      status: 'broken',
      correlationScore: 0,
      sampleSizeScore: 0,
      recencyScore: 0,
      lastBacktestDate: new Date().toISOString().split('T')[0],
      sampleCount: 0,
      rSquared: null,
    };
  }
}
