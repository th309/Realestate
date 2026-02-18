/**
 * Alert Processor Service
 *
 * Daily cron job that evaluates all active alerts against
 * current metric values and creates history entries when triggered.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AlertProcessorService {
  private readonly logger = new Logger(AlertProcessorService.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processAlerts() {
    this.logger.log('Starting daily alert processing...');

    const client = this.supabase.getClient();

    // 1. Fetch all active alerts
    const { data: alerts, error } = await client
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (error) {
      this.logger.error(`Failed to fetch active alerts: ${error.message}`);
      return;
    }

    if (!alerts?.length) {
      this.logger.log('No active alerts to process');
      return;
    }

    // 2. Deduplicate metric queries — group alerts by unique market/metric combo
    const uniqueKeys = new Set<string>();
    for (const alert of alerts) {
      uniqueKeys.add(
        `${alert.metric_id}:${alert.geography_type}:${alert.geography_id}`,
      );
    }

    // 3. Batch-fetch all unique metric values (one query per unique combo)
    const metricValues = new Map<string, number | null>();
    for (const key of uniqueKeys) {
      const [metricId, geoType, geoId] = key.split(':');
      try {
        const value = await this.fetchCurrentMetricValue(
          metricId,
          geoType,
          geoId,
        );
        metricValues.set(key, value);
      } catch (err) {
        this.logger.error(
          `Failed to fetch metric ${key}: ${err instanceof Error ? err.message : err}`,
        );
        metricValues.set(key, null);
      }
    }

    this.logger.log(
      `Fetched ${metricValues.size} unique metric values for ${alerts.length} alerts`,
    );

    // 4. Evaluate each alert against the cached metric values
    const historyInserts: {
      alert_id: string;
      metric_value: number;
      notified_via: string;
    }[] = [];
    const triggeredIds: string[] = [];

    for (const alert of alerts) {
      try {
        const key = `${alert.metric_id}:${alert.geography_type}:${alert.geography_id}`;
        const currentValue = metricValues.get(key) ?? null;

        if (currentValue == null) continue;

        // Check condition
        const isTriggered = this.checkCondition(
          alert.condition,
          currentValue,
          Number(alert.threshold),
        );

        if (!isTriggered) continue;

        // Dedup: skip if last_triggered_at is within 24 hours
        if (alert.last_triggered_at) {
          const lastTriggered = new Date(alert.last_triggered_at);
          const hoursSince =
            (Date.now() - lastTriggered.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) continue;
        }

        // Collect for batch insert/update
        historyInserts.push({
          alert_id: alert.id,
          metric_value: currentValue,
          notified_via: 'in-app',
        });
        triggeredIds.push(alert.id);
      } catch (err) {
        this.logger.error(
          `Failed to evaluate alert ${alert.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // 5. Batch insert alert_history entries
    if (historyInserts.length > 0) {
      const { error: insertError } = await client
        .from('alert_history')
        .insert(historyInserts);

      if (insertError) {
        this.logger.error(
          `Failed to batch insert alert history: ${insertError.message}`,
        );
      }
    }

    // 6. Batch update last_triggered_at for all triggered alerts
    if (triggeredIds.length > 0) {
      const { error: updateError } = await client
        .from('user_alerts')
        .update({ last_triggered_at: new Date().toISOString() })
        .in('id', triggeredIds);

      if (updateError) {
        this.logger.error(
          `Failed to batch update last_triggered_at: ${updateError.message}`,
        );
      }
    }

    this.logger.log(
      `Alert processing complete. ${triggeredIds.length}/${alerts.length} alerts triggered.`,
    );
  }

  private checkCondition(
    condition: string,
    value: number,
    threshold: number,
  ): boolean {
    switch (condition) {
      case 'above':
        return value > threshold;
      case 'below':
        return value < threshold;
      case 'crosses':
        // TODO: Requires tracking previous metric values to detect threshold crossings.
        // Disabled to prevent false-positive daily notifications. See #crosses-impl
        return false;
      default:
        return false;
    }
  }

  private async fetchCurrentMetricValue(
    metricId: string,
    geoType: string,
    geoId: string,
  ): Promise<number | null> {
    const client = this.supabase.getClient();

    // Try calculated_metrics first (most metrics are there)
    const { data } = await client
      .from('calculated_metrics')
      .select(metricId)
      .eq('geography_type', geoType)
      .eq('geography_id', geoId)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (data?.[metricId] != null) return Number(data[metricId]);
    return null;
  }
}
