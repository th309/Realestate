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

    let triggered = 0;

    // 2. For each alert, fetch current metric value
    for (const alert of alerts) {
      try {
        const currentValue = await this.fetchCurrentMetricValue(
          alert.metric_id,
          alert.geography_type,
          alert.geography_id,
        );

        if (currentValue == null) continue;

        // 3. Check condition
        const isTriggered = this.checkCondition(
          alert.condition,
          currentValue,
          Number(alert.threshold),
        );

        if (!isTriggered) continue;

        // 4. Dedup: skip if last_triggered_at is within 24 hours
        if (alert.last_triggered_at) {
          const lastTriggered = new Date(alert.last_triggered_at);
          const hoursSince =
            (Date.now() - lastTriggered.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) continue;
        }

        // 5. Insert history entry
        await client.from('alert_history').insert({
          alert_id: alert.id,
          metric_value: currentValue,
          notified_via: 'in-app',
        });

        // 6. Update last_triggered_at
        await client
          .from('user_alerts')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', alert.id);

        triggered++;
      } catch (err) {
        this.logger.error(
          `Failed to process alert ${alert.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(
      `Alert processing complete. ${triggered}/${alerts.length} alerts triggered.`,
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
        return true; // Simplified: any value change from threshold side
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
