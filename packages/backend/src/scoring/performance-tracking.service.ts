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
import type { ScoreResult } from './scoring.service';
import { GeographyLevel, ScoreType } from './formula-weights';
import type {
  PerformanceMetrics,
  AlertResult,
  ValidationResult,
} from './performance-tracking.types';
import {
  recordScorePrediction,
  recordScorePredictions,
} from './performance-tracking-predictions.helper';
import {
  runValidatePredictions1Y,
  runValidatePredictions3Y,
} from './performance-tracking-validation.helper';
import {
  fetchPerformanceMetrics,
  fetchAllPerformanceMetrics,
  checkAlerts,
  fetchActiveAlerts,
} from './performance-tracking-metrics.helper';

export type {
  PredictionRecord,
  PerformanceMetrics,
  AlertResult,
  ValidationResult,
} from './performance-tracking.types';

@Injectable()
export class PerformanceTrackingService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Record a prediction for later validation.
   * Called after scores are calculated.
   */
  async recordPrediction(score: ScoreResult): Promise<void> {
    return recordScorePrediction(this.supabase, score);
  }

  /**
   * Record predictions for multiple scores (batch)
   */
  async recordPredictions(
    scores: ScoreResult[],
  ): Promise<{ recorded: number; errors: number }> {
    return recordScorePredictions(this.supabase, scores);
  }

  /**
   * Validate predictions from 12 months ago.
   * Should be run monthly as a scheduled job.
   */
  async validatePredictions(): Promise<ValidationResult> {
    return runValidatePredictions1Y(this.supabase);
  }

  /**
   * Validate predictions from 36 months ago against actual 3-year outcomes.
   * Should be run monthly alongside validatePredictions().
   *
   * This is the primary validation horizon — scores are trained to predict
   * 3-year excess returns vs state median.
   */
  async validatePredictions3Y(): Promise<ValidationResult> {
    return runValidatePredictions3Y(this.supabase);
  }

  /**
   * Get performance metrics for a specific geography and score type.
   */
  async getPerformanceMetrics(
    geography: GeographyLevel,
    scoreType: ScoreType,
  ): Promise<PerformanceMetrics> {
    return fetchPerformanceMetrics(this.supabase, geography, scoreType);
  }

  /**
   * Get performance metrics for all geography/score type combinations.
   */
  async getAllPerformanceMetrics(): Promise<PerformanceMetrics[]> {
    return fetchAllPerformanceMetrics(this.supabase);
  }

  /**
   * Check for performance alerts.
   */
  async checkAlerts(): Promise<AlertResult[]> {
    return checkAlerts(this.supabase);
  }

  /**
   * Get only critical and warning alerts.
   */
  async getActiveAlerts(): Promise<AlertResult[]> {
    return fetchActiveAlerts(this.supabase);
  }
}
