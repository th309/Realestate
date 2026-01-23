/**
 * Performance Tracking Service
 *
 * Tracks score predictions and validates against actual outcomes.
 * Implements the performance tracking system from SCORING_SYSTEM_SPEC.md.
 *
 * Key functions:
 * - recordPrediction: Save a prediction when a score is calculated
 * - validatePredictions: Run monthly validation on 12-month-old predictions
 * - getPerformanceMetrics: Get aggregated performance metrics
 * - checkAlerts: Check for performance alerts
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoreResult } from './scoring.service';
import { GeographyLevel, ScoreType, ALERT_THRESHOLDS } from './formula-weights';

export interface PredictionRecord {
  geography: GeographyLevel;
  location_id: string;
  location_name: string;
  score_type: ScoreType;
  prediction_date: string;
  predicted_score: number;
  predicted_grade: string;
  predicted_quintile: number;
  price_at_prediction: number | null;
}

export interface PerformanceMetrics {
  geography: string;
  score_type: string;
  validation_period: string;
  metrics: {
    top_quintile_beat_rate: number | null;
    top_quintile_return: number | null;
    bottom_quintile_beat_rate: number | null;
    bottom_quintile_return: number | null;
    spread: number | null;
    predictions_validated: number;
  };
  status: 'healthy' | 'warning' | 'critical';
  formula_version: string;
  last_validated: string | null;
}

export interface AlertResult {
  geography: string;
  score_type: string;
  metric: string;
  current_value: number;
  threshold: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface ValidationResult {
  validated: number;
  errors: number;
  predictionDate: string;
}

@Injectable()
export class PerformanceTrackingService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ============================================================================
  // Record Predictions
  // ============================================================================

  /**
   * Record a prediction for later validation.
   * Called after scores are calculated.
   */
  async recordPrediction(score: ScoreResult): Promise<void> {
    const predictionDate = score.score_date;
    const scoreTypes: ScoreType[] = ['homeready', 'investoredge', 'markethealth'];

    // Calculate quintiles based on all scores for this geography
    const quintiles = await this.calculateQuintiles(score.geography, predictionDate);

    for (const scoreType of scoreTypes) {
      const scoreData = score.scores[scoreType];
      const quintile = this.getQuintile(scoreData.score, quintiles[scoreType]);

      const record: PredictionRecord = {
        geography: score.geography,
        location_id: score.location_id,
        location_name: score.location_name,
        score_type: scoreType,
        prediction_date: predictionDate,
        predicted_score: scoreData.score,
        predicted_grade: scoreData.grade,
        predicted_quintile: quintile,
        price_at_prediction: score.median_price,
      };

      await this.savePrediction(record);
    }
  }

  /**
   * Record predictions for multiple scores (batch)
   */
  async recordPredictions(scores: ScoreResult[]): Promise<{ recorded: number; errors: number }> {
    let recorded = 0;
    let errors = 0;

    for (const score of scores) {
      try {
        await this.recordPrediction(score);
        recorded++;
      } catch (err) {
        errors++;
        console.error(`Error recording prediction for ${score.location_id}:`, err);
      }
    }

    return { recorded, errors };
  }

  private async savePrediction(record: PredictionRecord): Promise<void> {
    const { error } = await this.supabase.from('score_performance_tracking').upsert(
      {
        geography: record.geography,
        location_id: record.location_id,
        location_name: record.location_name,
        score_type: record.score_type,
        prediction_date: record.prediction_date,
        predicted_score: record.predicted_score,
        predicted_grade: record.predicted_grade,
        predicted_quintile: record.predicted_quintile,
        price_at_prediction: record.price_at_prediction,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'geography,location_id,score_type,prediction_date',
      },
    );

    if (error) {
      throw error;
    }
  }

  private async calculateQuintiles(
    geography: GeographyLevel,
    periodDate: string,
  ): Promise<Record<ScoreType, number[]>> {
    // Get all scores for this geography and date
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('score_type, score')
      .eq('geography', geography)
      .eq('score_date', periodDate);

    const quintiles: Record<ScoreType, number[]> = {
      homeready: [],
      investoredge: [],
      markethealth: [],
    };

    if (!data || data.length === 0) {
      // Default quintile breakpoints (0, 20, 40, 60, 80, 100)
      for (const scoreType of Object.keys(quintiles) as ScoreType[]) {
        quintiles[scoreType] = [0, 20, 40, 60, 80, 100];
      }
      return quintiles;
    }

    // Group scores by type
    const scoresByType: Record<string, number[]> = {};
    for (const row of data) {
      if (!scoresByType[row.score_type]) {
        scoresByType[row.score_type] = [];
      }
      if (row.score != null) {
        scoresByType[row.score_type].push(row.score);
      }
    }

    // Calculate quintile breakpoints for each score type
    for (const scoreType of Object.keys(quintiles) as ScoreType[]) {
      const scores = scoresByType[scoreType] || [];
      if (scores.length < 5) {
        quintiles[scoreType] = [0, 20, 40, 60, 80, 100];
      } else {
        scores.sort((a, b) => a - b);
        quintiles[scoreType] = [
          scores[0],
          scores[Math.floor(scores.length * 0.2)],
          scores[Math.floor(scores.length * 0.4)],
          scores[Math.floor(scores.length * 0.6)],
          scores[Math.floor(scores.length * 0.8)],
          scores[scores.length - 1],
        ];
      }
    }

    return quintiles;
  }

  private getQuintile(score: number, breakpoints: number[]): number {
    // 1 = bottom 20%, 5 = top 20%
    if (score >= breakpoints[4]) return 5;
    if (score >= breakpoints[3]) return 4;
    if (score >= breakpoints[2]) return 3;
    if (score >= breakpoints[1]) return 2;
    return 1;
  }

  // ============================================================================
  // Validate Predictions
  // ============================================================================

  /**
   * Validate predictions from 12 months ago.
   * Should be run monthly as a scheduled job.
   */
  async validatePredictions(): Promise<ValidationResult> {
    // Calculate the prediction date to validate (12 months ago)
    const now = new Date();
    const predictionDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const predictionDateStr = predictionDate.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01

    // Get predictions that haven't been validated yet
    const { data: predictions, error } = await this.supabase
      .from('score_performance_tracking')
      .select('*')
      .eq('prediction_date', predictionDateStr)
      .is('validated_1y_at', null);

    if (error || !predictions || predictions.length === 0) {
      return { validated: 0, errors: 0, predictionDate: predictionDateStr };
    }

    // Get actual returns from Zillow data
    // We need to calculate: (current_price - price_at_prediction) / price_at_prediction * 100
    const currentDate = now.toISOString().slice(0, 10);

    // Group predictions by geography for batch processing
    const predictionsByGeo = new Map<string, typeof predictions>();
    for (const pred of predictions) {
      const key = pred.geography;
      if (!predictionsByGeo.has(key)) {
        predictionsByGeo.set(key, []);
      }
      predictionsByGeo.get(key)!.push(pred);
    }

    // Calculate market medians per geography for comparison
    const medians = await this.calculateMarketMedians(predictions, currentDate);

    let validated = 0;
    let errors = 0;

    for (const pred of predictions) {
      try {
        const actualReturn = await this.getActualReturn(
          pred.location_id,
          pred.geography,
          pred.price_at_prediction,
        );

        if (actualReturn === null) {
          // Can't validate without current price
          continue;
        }

        const medianReturn = medians[pred.geography] || 0;
        const beatMarket = actualReturn > medianReturn;

        // Update the prediction with actual outcome
        const { error: updateError } = await this.supabase
          .from('score_performance_tracking')
          .update({
            actual_return_1y: actualReturn,
            beat_market_1y: beatMarket,
            validated_1y_at: new Date().toISOString(),
          })
          .eq('id', pred.id);

        if (updateError) {
          errors++;
        } else {
          validated++;
        }
      } catch (err) {
        errors++;
        console.error(`Error validating prediction ${pred.id}:`, err);
      }
    }

    return { validated, errors, predictionDate: predictionDateStr };
  }

  private async calculateMarketMedians(
    predictions: any[],
    currentDate: string,
  ): Promise<Record<string, number>> {
    const medians: Record<string, number> = {};
    const geographies = [...new Set(predictions.map(p => p.geography))];

    for (const geography of geographies) {
      // Get all returns for this geography
      const geoPredictions = predictions.filter(p => p.geography === geography);
      const returns: number[] = [];

      for (const pred of geoPredictions) {
        const actualReturn = await this.getActualReturn(
          pred.location_id,
          geography,
          pred.price_at_prediction,
        );
        if (actualReturn !== null) {
          returns.push(actualReturn);
        }
      }

      if (returns.length > 0) {
        returns.sort((a, b) => a - b);
        medians[geography] = returns[Math.floor(returns.length / 2)];
      } else {
        medians[geography] = 0;
      }
    }

    return medians;
  }

  private async getActualReturn(
    locationId: string,
    geography: GeographyLevel,
    priceAtPrediction: number | null,
  ): Promise<number | null> {
    if (!priceAtPrediction || priceAtPrediction === 0) {
      return null;
    }

    // Get current price from propertyiq_scores or realtor data
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('median_price')
      .eq('location_id', locationId)
      .eq('geography', geography)
      .eq('score_type', 'homeready') // Just need one to get median_price
      .order('score_date', { ascending: false })
      .limit(1);

    if (!data || data.length === 0 || !data[0].median_price) {
      return null;
    }

    const currentPrice = data[0].median_price;
    const returnPct = ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;

    return Math.round(returnPct * 100) / 100; // Round to 2 decimals
  }

  // ============================================================================
  // Performance Metrics
  // ============================================================================

  /**
   * Get performance metrics for a specific geography and score type.
   */
  async getPerformanceMetrics(
    geography: GeographyLevel,
    scoreType: ScoreType,
  ): Promise<PerformanceMetrics> {
    // Query the performance metrics view
    const { data: metrics } = await this.supabase
      .from('score_performance_metrics')
      .select('*')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .single();

    // Get the active formula version
    const { data: formula } = await this.supabase
      .from('formula_versions')
      .select('version')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('status', 'active')
      .single();

    // Get the last validation date
    const { data: lastValidation } = await this.supabase
      .from('score_performance_tracking')
      .select('validated_1y_at')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .not('validated_1y_at', 'is', null)
      .order('validated_1y_at', { ascending: false })
      .limit(1);

    // Calculate validation period (last 24 months of validated predictions)
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
    const validationPeriod = `${twoYearsAgo.toISOString().slice(0, 7)} to ${now.toISOString().slice(0, 7)}`;

    // Determine status
    const topBeatRate = metrics?.top_quintile_beat_rate ?? 0;
    const spread = metrics?.spread ?? 0;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (topBeatRate < ALERT_THRESHOLDS.top_quintile_beat_rate.critical ||
        spread < ALERT_THRESHOLDS.spread.critical) {
      status = 'critical';
    } else if (topBeatRate < ALERT_THRESHOLDS.top_quintile_beat_rate.warning ||
               spread < ALERT_THRESHOLDS.spread.warning) {
      status = 'warning';
    }

    return {
      geography,
      score_type: scoreType,
      validation_period: validationPeriod,
      metrics: {
        top_quintile_beat_rate: metrics?.top_quintile_beat_rate ?? null,
        top_quintile_return: metrics?.top_quintile_return ?? null,
        bottom_quintile_beat_rate: metrics?.bottom_quintile_beat_rate ?? null,
        bottom_quintile_return: metrics?.bottom_quintile_return ?? null,
        spread: metrics?.spread ?? null,
        predictions_validated: metrics?.total_predictions ?? 0,
      },
      status,
      formula_version: formula?.version ?? 'v1.0',
      last_validated: lastValidation?.[0]?.validated_1y_at ?? null,
    };
  }

  /**
   * Get performance metrics for all geography/score type combinations.
   */
  async getAllPerformanceMetrics(): Promise<PerformanceMetrics[]> {
    const geographies: GeographyLevel[] = ['metro', 'county', 'zip'];
    const scoreTypes: ScoreType[] = ['homeready', 'investoredge', 'markethealth'];
    const results: PerformanceMetrics[] = [];

    for (const geography of geographies) {
      for (const scoreType of scoreTypes) {
        const metrics = await this.getPerformanceMetrics(geography, scoreType);
        results.push(metrics);
      }
    }

    return results;
  }

  // ============================================================================
  // Alerts
  // ============================================================================

  /**
   * Check for performance alerts.
   */
  async checkAlerts(): Promise<AlertResult[]> {
    // Use the database function to check alerts
    const { data, error } = await this.supabase.rpc('check_score_performance');

    if (error) {
      console.error('Error checking alerts:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      geography: row.geography,
      score_type: row.score_type,
      metric: row.metric,
      current_value: row.current_value,
      threshold: row.threshold,
      status: row.status as 'OK' | 'WARNING' | 'CRITICAL',
    }));
  }

  /**
   * Get only critical and warning alerts.
   */
  async getActiveAlerts(): Promise<AlertResult[]> {
    const alerts = await this.checkAlerts();
    return alerts.filter(a => a.status === 'CRITICAL' || a.status === 'WARNING');
  }
}
