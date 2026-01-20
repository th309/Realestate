/**
 * Alert Service
 *
 * Manages confidence alerts when scores drop below thresholds.
 * Creates, tracks, and resolves alerts based on confidence changes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import type { ConfidenceScore } from './confidence-calculator.service';

export interface Alert {
  id: string;
  confidenceId: string | null;
  scoreType: ScoreType;
  geographyType: GeographyType;
  formulaVersion: string;
  alertType: 'threshold' | 'degradation' | 'anomaly';
  severity: 'warning' | 'critical';
  previousConfidence: number | null;
  currentConfidence: number;
  thresholdCrossed: number;
  diagnosticSignals: DiagnosticSignal[];
  recommendedActions: string[];
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface DiagnosticSignal {
  name: string;
  description: string;
  value: number | string;
  severity: 'info' | 'warning' | 'critical';
}

// Alert thresholds
const ALERT_THRESHOLDS = {
  WARNING: 55, // Below this triggers warning
  CRITICAL: 40, // Below this triggers critical
  DEGRADATION_THRESHOLD: 10, // % drop to trigger degradation alert
};

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Check confidence and create alerts if needed
   */
  async checkAndCreateAlerts(
    newConfidence: ConfidenceScore,
    previousConfidence: ConfidenceScore | null,
  ): Promise<Alert | null> {
    // Check for threshold crossing
    const thresholdAlertData = this.checkThresholdCrossing(newConfidence, previousConfidence);
    if (thresholdAlertData) {
      return await this.createAlert(thresholdAlertData);
    }

    // Check for significant degradation
    const degradationAlertData = this.checkDegradation(newConfidence, previousConfidence);
    if (degradationAlertData) {
      return await this.createAlert(degradationAlertData);
    }

    // Check for anomalies
    const anomalyAlertData = this.checkAnomalies(newConfidence);
    if (anomalyAlertData) {
      return await this.createAlert(anomalyAlertData);
    }

    // Check for recovery (auto-resolve existing alerts)
    await this.checkRecovery(newConfidence);

    return null;
  }

  /**
   * Get open alerts
   */
  async getOpenAlerts(scoreType?: ScoreType): Promise<Alert[]> {
    const client = this.supabase.getClient();

    let query = client
      .from('propertyiq_confidence_alerts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (scoreType) {
      query = query.eq('score_type', scoreType);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(this.mapDbToAlert);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('propertyiq_confidence_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      this.logger.error(`Error acknowledging alert ${alertId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, notes?: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('propertyiq_confidence_alerts')
      .update({
        status: 'resolved',
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', alertId);

    if (error) {
      this.logger.error(`Error resolving alert ${alertId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Dismiss an alert (false positive)
   */
  async dismissAlert(alertId: string, resolvedBy: string, notes?: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('propertyiq_confidence_alerts')
      .update({
        status: 'dismissed',
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', alertId);

    if (error) {
      this.logger.error(`Error dismissing alert ${alertId}: ${error.message}`);
      throw error;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private checkThresholdCrossing(
    newConfidence: ConfidenceScore,
    previousConfidence: ConfidenceScore | null,
  ): Omit<Alert, 'id' | 'createdAt'> | null {
    const prevScore = previousConfidence?.confidenceScore ?? 100;
    const newScore = newConfidence.confidenceScore;

    // Check critical threshold
    if (newScore < ALERT_THRESHOLDS.CRITICAL && prevScore >= ALERT_THRESHOLDS.CRITICAL) {
      return this.buildAlert(
        newConfidence,
        previousConfidence,
        'threshold',
        'critical',
        ALERT_THRESHOLDS.CRITICAL,
      );
    }

    // Check warning threshold
    if (newScore < ALERT_THRESHOLDS.WARNING && prevScore >= ALERT_THRESHOLDS.WARNING) {
      return this.buildAlert(
        newConfidence,
        previousConfidence,
        'threshold',
        'warning',
        ALERT_THRESHOLDS.WARNING,
      );
    }

    return null;
  }

  private checkDegradation(
    newConfidence: ConfidenceScore,
    previousConfidence: ConfidenceScore | null,
  ): Omit<Alert, 'id' | 'createdAt'> | null {
    if (!previousConfidence) return null;

    const drop = previousConfidence.confidenceScore - newConfidence.confidenceScore;

    if (drop >= ALERT_THRESHOLDS.DEGRADATION_THRESHOLD) {
      const severity = drop >= 20 ? 'critical' : 'warning';
      return this.buildAlert(
        newConfidence,
        previousConfidence,
        'degradation',
        severity,
        previousConfidence.confidenceScore - ALERT_THRESHOLDS.DEGRADATION_THRESHOLD,
      );
    }

    return null;
  }

  private checkAnomalies(
    newConfidence: ConfidenceScore,
  ): Omit<Alert, 'id' | 'createdAt'> | null {
    const anomalies: DiagnosticSignal[] = [];

    // Check for very low R²
    if (newConfidence.rSquared !== null && newConfidence.rSquared < 0.1) {
      anomalies.push({
        name: 'Low Correlation',
        description: 'Score has very weak correlation with outcomes',
        value: newConfidence.rSquared,
        severity: 'critical',
      });
    }

    // Check for low sample count
    if (newConfidence.sampleCount < 10) {
      anomalies.push({
        name: 'Insufficient Samples',
        description: 'Not enough data points to establish confidence',
        value: newConfidence.sampleCount,
        severity: 'warning',
      });
    }

    if (anomalies.length > 0) {
      const severity = anomalies.some((a) => a.severity === 'critical') ? 'critical' : 'warning';

      return {
        confidenceId: null,
        scoreType: newConfidence.scoreType,
        geographyType: newConfidence.geographyType,
        formulaVersion: newConfidence.formulaVersion,
        alertType: 'anomaly',
        severity,
        previousConfidence: null,
        currentConfidence: newConfidence.confidenceScore,
        thresholdCrossed: 0,
        diagnosticSignals: anomalies,
        recommendedActions: this.generateRecommendations('anomaly', anomalies),
        status: 'open',
      };
    }

    return null;
  }

  private async checkRecovery(newConfidence: ConfidenceScore): Promise<void> {
    // If confidence is now healthy, auto-resolve related alerts
    if (newConfidence.status === 'healthy') {
      const client = this.supabase.getClient();

      const { error } = await client
        .from('propertyiq_confidence_alerts')
        .update({
          status: 'resolved',
          resolved_by: 'system',
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Auto-resolved: confidence recovered to healthy level',
        })
        .eq('score_type', newConfidence.scoreType)
        .eq('geography_type', newConfidence.geographyType)
        .eq('status', 'open');

      if (error) {
        this.logger.error(`Error auto-resolving alerts: ${error.message}`);
      }
    }
  }

  private buildAlert(
    newConfidence: ConfidenceScore,
    previousConfidence: ConfidenceScore | null,
    alertType: 'threshold' | 'degradation' | 'anomaly',
    severity: 'warning' | 'critical',
    threshold: number,
  ): Omit<Alert, 'id' | 'createdAt'> {
    const diagnostics = this.generateDiagnostics(newConfidence, previousConfidence);
    const recommendations = this.generateRecommendations(alertType, diagnostics);

    return {
      confidenceId: null,
      scoreType: newConfidence.scoreType,
      geographyType: newConfidence.geographyType,
      formulaVersion: newConfidence.formulaVersion,
      alertType,
      severity,
      previousConfidence: previousConfidence?.confidenceScore ?? null,
      currentConfidence: newConfidence.confidenceScore,
      thresholdCrossed: threshold,
      diagnosticSignals: diagnostics,
      recommendedActions: recommendations,
      status: 'open',
    };
  }

  private generateDiagnostics(
    newConfidence: ConfidenceScore,
    previousConfidence: ConfidenceScore | null,
  ): DiagnosticSignal[] {
    const signals: DiagnosticSignal[] = [];

    // Correlation analysis
    if (newConfidence.correlationScore < 50) {
      signals.push({
        name: 'Correlation Drop',
        description: 'Score correlation with outcomes is below expected',
        value: `${newConfidence.correlationScore.toFixed(1)}%`,
        severity: newConfidence.correlationScore < 30 ? 'critical' : 'warning',
      });
    }

    // Sample size analysis
    if (newConfidence.sampleSizeScore < 50) {
      signals.push({
        name: 'Sample Size',
        description: 'Insufficient sample size for reliable confidence',
        value: newConfidence.sampleCount,
        severity: 'warning',
      });
    }

    // Recency analysis
    if (newConfidence.recencyScore < 50) {
      signals.push({
        name: 'Data Staleness',
        description: 'Backtest data is becoming outdated',
        value: `${newConfidence.recencyScore.toFixed(1)}%`,
        severity: newConfidence.recencyScore < 25 ? 'critical' : 'warning',
      });
    }

    // R² analysis
    if (newConfidence.rSquared !== null) {
      if (newConfidence.rSquared < 0.2) {
        signals.push({
          name: 'R² Value',
          description: 'Very weak predictive power',
          value: newConfidence.rSquared.toFixed(4),
          severity: 'critical',
        });
      } else if (newConfidence.rSquared < 0.3) {
        signals.push({
          name: 'R² Value',
          description: 'Weak predictive power',
          value: newConfidence.rSquared.toFixed(4),
          severity: 'warning',
        });
      }
    }

    return signals;
  }

  private generateRecommendations(
    alertType: string,
    diagnostics: DiagnosticSignal[],
  ): string[] {
    const recommendations: string[] = [];

    if (alertType === 'threshold' || alertType === 'degradation') {
      recommendations.push('Review recent formula changes');
      recommendations.push('Check for data quality issues in source metrics');
      recommendations.push('Consider running additional backtests');
    }

    for (const signal of diagnostics) {
      if (signal.name === 'Correlation Drop') {
        recommendations.push('Review metric weights and normalization');
        recommendations.push('Investigate if market conditions have changed');
      }
      if (signal.name === 'Sample Size') {
        recommendations.push('Wait for more data to accumulate');
        recommendations.push('Consider broadening geography scope');
      }
      if (signal.name === 'Data Staleness') {
        recommendations.push('Run fresh backtest with recent data');
      }
    }

    // Deduplicate
    return [...new Set(recommendations)];
  }

  private async createAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_confidence_alerts')
      .insert({
        confidence_id: alert.confidenceId,
        score_type: alert.scoreType,
        geography_type: alert.geographyType,
        formula_version: alert.formulaVersion,
        alert_type: alert.alertType,
        severity: alert.severity,
        previous_confidence: alert.previousConfidence,
        current_confidence: alert.currentConfidence,
        threshold_crossed: alert.thresholdCrossed,
        diagnostic_signals: alert.diagnosticSignals,
        recommended_actions: alert.recommendedActions,
        status: alert.status,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Error creating alert: ${error?.message}`);
      throw error;
    }

    this.logger.warn(
      `Created ${alert.severity} ${alert.alertType} alert for ${alert.scoreType}/${alert.geographyType}`,
    );

    return this.mapDbToAlert(data);
  }

  private mapDbToAlert(row: Record<string, unknown>): Alert {
    return {
      id: row.id as string,
      confidenceId: row.confidence_id as string | null,
      scoreType: row.score_type as ScoreType,
      geographyType: row.geography_type as GeographyType,
      formulaVersion: row.formula_version as string,
      alertType: row.alert_type as 'threshold' | 'degradation' | 'anomaly',
      severity: row.severity as 'warning' | 'critical',
      previousConfidence: row.previous_confidence as number | null,
      currentConfidence: row.current_confidence as number,
      thresholdCrossed: row.threshold_crossed as number,
      diagnosticSignals: row.diagnostic_signals as DiagnosticSignal[],
      recommendedActions: row.recommended_actions as string[],
      status: row.status as 'open' | 'acknowledged' | 'resolved' | 'dismissed',
      createdAt: row.created_at as string,
    };
  }
}
