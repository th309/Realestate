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
import type { Alert, DiagnosticSignal } from './alert.types';
import {
  checkThresholdCrossing,
  checkDegradation,
  checkAnomalies,
} from './alert-detection.helper';

export type { Alert, DiagnosticSignal } from './alert.types';

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
    const thresholdAlertData = checkThresholdCrossing(
      newConfidence,
      previousConfidence,
    );
    if (thresholdAlertData) {
      return await this.createAlert(thresholdAlertData);
    }

    // Check for significant degradation
    const degradationAlertData = checkDegradation(
      newConfidence,
      previousConfidence,
    );
    if (degradationAlertData) {
      return await this.createAlert(degradationAlertData);
    }

    // Check for anomalies
    const anomalyAlertData = checkAnomalies(newConfidence);
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
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
  ): Promise<void> {
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
      this.logger.error(
        `Error acknowledging alert ${alertId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<void> {
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
  async dismissAlert(
    alertId: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<void> {
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
  // Private Methods (I/O)
  // ========================================================================

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
          resolution_notes:
            'Auto-resolved: confidence recovered to healthy level',
        })
        .eq('score_type', newConfidence.scoreType)
        .eq('geography_type', newConfidence.geographyType)
        .eq('status', 'open');

      if (error) {
        this.logger.error(`Error auto-resolving alerts: ${error.message}`);
      }
    }
  }

  private async createAlert(
    alert: Omit<Alert, 'id' | 'createdAt'>,
  ): Promise<Alert> {
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
