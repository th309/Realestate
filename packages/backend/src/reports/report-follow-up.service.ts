/**
 * Report Follow-Up Service
 *
 * Handles post-delivery engagement for reports:
 * - Extracts watch metrics from AI narratives to create threshold alerts
 * - Checks active alerts against current metric values
 * - Generates 30-day market change summaries
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';
import {
  FollowUpAlert,
  AlertCheckResult,
  MarketChange,
  ReportFollowUpData,
  MIN_CHANGE_PERCENT,
  extractWatchMetrics,
  extractTrackableMetrics,
  parseNumericValue,
} from './report-follow-up.types';

@Injectable()
export class ReportFollowUpService {
  private readonly logger = new Logger(ReportFollowUpService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiProvider: AiProviderService,
    private readonly metricResolution: MetricResolutionService,
  ) {}

  /**
   * Parse watch metrics from a report's AI narrative and create alert rows.
   * Reads `what_to_watch` (HomeReady) or `actions_and_monitoring` (InvestorEdge).
   */
  async createAlertsFromReport(
    reportId: string,
    userId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { data: report, error } = await client
      .from('reports')
      .select('ai_narrative')
      .eq('id', reportId)
      .single();

    if (error || !report?.ai_narrative) {
      this.logger.warn(
        `No AI narrative for report ${reportId}: ${error?.message}`,
      );
      return;
    }

    const narrative = report.ai_narrative;
    const watchSection =
      narrative.what_to_watch || narrative.actions_and_monitoring;

    if (!watchSection) {
      this.logger.debug(`No watch section in report ${reportId}`);
      return;
    }

    const metrics = extractWatchMetrics(watchSection);
    if (metrics.length === 0) return;

    const alertRows = metrics.map((metric) => ({
      report_id: reportId,
      user_id: userId,
      metric_name: metric.name,
      current_value: parseNumericValue(metric.current_value),
      threshold_value: parseNumericValue(metric.watch_threshold),
      direction: metric.direction === 'above' ? 'up' : 'down',
      rationale: metric.implication,
      status: 'active',
    }));

    const { error: insertError } = await client
      .from('report_follow_up_alerts')
      .insert(alertRows);

    if (insertError) {
      this.logger.error(`Failed to insert alerts: ${insertError.message}`);
    } else {
      this.logger.log(
        `Created ${alertRows.length} alerts for report ${reportId}`,
      );
    }
  }

  /**
   * Check all active alerts against current metric values.
   * Updates triggered alerts in the database.
   */
  async checkActiveAlerts(): Promise<AlertCheckResult[]> {
    const client = this.supabase.getClient();

    const { data: alerts, error } = await client
      .from('report_follow_up_alerts')
      .select('*, reports!inner(primary_geography)')
      .eq('status', 'active');

    if (error || !alerts?.length) return [];

    const results: AlertCheckResult[] = [];

    for (const alert of alerts) {
      const triggered = await this.evaluateAlert(alert);
      results.push({ alertId: alert.id, triggered });

      if (triggered) {
        await client
          .from('report_follow_up_alerts')
          .update({
            status: 'triggered',
            triggered_at: new Date().toISOString(),
          })
          .eq('id', alert.id);
      }
    }

    return results;
  }

  /**
   * Generate a 30-day market change summary for a report.
   * Compares current metrics to populated_data values at generation time.
   */
  async generate30DaySummary(reportId: string): Promise<string | null> {
    const followUp = await this.getReportFollowUp(reportId);
    if (followUp.marketChanges.length === 0) return null;

    const changesText = followUp.marketChanges
      .map(
        (c) =>
          `${c.metric}: ${c.oldValue} -> ${c.newValue} (${c.changePct > 0 ? '+' : ''}${c.changePct.toFixed(1)}%)`,
      )
      .join('\n');

    const response = await this.aiProvider.complete('report_follow_up', {
      systemPrompt:
        "You are a concise market analyst. Summarize the key market changes since the report was generated. Focus on what matters for the reader's decision-making. Keep it to 2-3 sentences.",
      userPrompt: `Market changes since report generation:\n${changesText}`,
      maxTokens: 300,
      temperature: 0.3,
    });

    return response.content;
  }

  /** Get all follow-up data for a specific report. */
  async getReportFollowUp(reportId: string): Promise<ReportFollowUpData> {
    const client = this.supabase.getClient();

    const [alertsResult, reportResult] = await Promise.all([
      client
        .from('report_follow_up_alerts')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false }),
      client
        .from('reports')
        .select('populated_data, primary_geography, created_at')
        .eq('id', reportId)
        .single(),
    ]);

    const alerts: FollowUpAlert[] = alertsResult.data || [];
    const report = reportResult.data;

    if (!report?.populated_data || !report.primary_geography) {
      return { alerts, marketChanges: [] };
    }

    const marketChanges = await this.computeMarketChanges(
      report.populated_data,
      report.primary_geography,
    );

    return { alerts, marketChanges };
  }

  /** Dismiss a specific alert. */
  async dismissAlert(alertId: string, userId: string): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('report_follow_up_alerts')
      .update({ status: 'dismissed' })
      .eq('id', alertId)
      .eq('user_id', userId);

    return !error;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async evaluateAlert(
    alert: FollowUpAlert & {
      reports?: { primary_geography?: { type?: GeoLevel; id?: string } };
    },
  ): Promise<boolean> {
    const geo = alert.reports?.primary_geography;
    if (!geo?.type || !geo?.id) return false;

    try {
      const resolved = await this.metricResolution.resolveMetric(
        alert.metric_name,
        geo.type,
        geo.id,
      );

      if (resolved.value === null) return false;

      return alert.direction === 'up'
        ? resolved.value >= alert.threshold_value
        : resolved.value <= alert.threshold_value;
    } catch {
      this.logger.debug(
        `Could not resolve ${alert.metric_name} for alert ${alert.id}`,
      );
      return false;
    }
  }

  private async computeMarketChanges(
    populatedData: Record<string, unknown>,
    primaryGeo: { type?: GeoLevel; id?: string },
  ): Promise<MarketChange[]> {
    if (!primaryGeo?.type || !primaryGeo?.id) return [];

    const trackable = extractTrackableMetrics(populatedData);
    if (trackable.length === 0) return [];

    try {
      const resolved = await this.metricResolution.resolveMetricBatch(
        trackable.map((m) => m.id),
        primaryGeo.type,
        primaryGeo.id,
      );

      const changes: MarketChange[] = [];

      for (const tracked of trackable) {
        const current = resolved[tracked.id];
        if (!current?.value || tracked.oldValue === 0) continue;

        const changePct =
          ((current.value - tracked.oldValue) / Math.abs(tracked.oldValue)) *
          100;

        if (Math.abs(changePct) > MIN_CHANGE_PERCENT) {
          changes.push({
            metric: tracked.label,
            oldValue: tracked.oldValue,
            newValue: current.value,
            changePct,
          });
        }
      }

      return changes.sort(
        (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct),
      );
    } catch {
      this.logger.debug('Failed to compute market changes');
      return [];
    }
  }
}
