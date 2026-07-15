/**
 * Alert Processor Service
 *
 * Daily cron job that evaluates all active alerts against
 * current metric values and creates history entries when triggered.
 *
 * Schema note: `user_alerts`' live DB columns are `metric_name` /
 * `condition_type` / `threshold_value` (from scripts/migrations/030), NOT
 * `metric_id` / `condition` / `threshold` as the public DTO/API layer names
 * them (see AlertsService.CreateAlertDto) — verified directly against the
 * live table via `information_schema.columns` (2026-07-12), no ALTER
 * migration or compatibility view exists anywhere in the repo. This file
 * reads the real columns; the public field names (`metric_id`/`condition`/
 * `threshold`) are kept only as this file's own internal shape for the
 * push-notification payload, unchanged so as not to touch the DTO contract
 * the frontend alert-creation UI already depends on.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AlertsService } from './alerts.service';
import { PushService } from '../push/push.service';
import { fetchCurrentMetricValue } from './alert-metric-resolver';

interface TriggeredAlert {
  id: string;
  user_id: string;
  geography_name: string | null;
  geography_id: string;
  metric_id: string;
  condition: string;
  threshold: number;
  metric_value: number;
}

@Injectable()
export class AlertProcessorService {
  private readonly logger = new Logger(AlertProcessorService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly alertsService: AlertsService,
    private readonly pushService: PushService,
  ) {}

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
        `${alert.metric_name}:${alert.geography_type}:${alert.geography_id}`,
      );
    }

    // 3. Batch-fetch all unique metric values (one query per unique combo)
    const metricValues = new Map<string, number | null>();
    for (const key of uniqueKeys) {
      const [metricId, geoType, geoId] = key.split(':');
      try {
        const value = await fetchCurrentMetricValue(
          client,
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
    const nowIso = new Date().toISOString();
    const historyInserts: {
      alert_id: string;
      metric_value: number;
      notified_via: string;
      triggered_at: string;
    }[] = [];
    const triggeredIds: string[] = [];
    const triggeredAlerts: TriggeredAlert[] = [];

    for (const alert of alerts) {
      try {
        const key = `${alert.metric_name}:${alert.geography_type}:${alert.geography_id}`;
        const currentValue = metricValues.get(key) ?? null;

        if (currentValue == null) continue;

        // Check condition
        const isTriggered = this.checkCondition(
          alert.condition_type,
          currentValue,
          Number(alert.threshold_value),
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
          triggered_at: nowIso,
        });
        triggeredIds.push(alert.id);
        triggeredAlerts.push({
          id: alert.id,
          user_id: alert.user_id,
          geography_name: alert.geography_name,
          geography_id: alert.geography_id,
          metric_id: alert.metric_name,
          condition: alert.condition_type,
          threshold: Number(alert.threshold_value),
          metric_value: currentValue,
        });
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
      } else {
        // 5b. Push notify — fire per triggered alert, isolated so a push
        // failure can never break alert processing (steps 6/7 always run).
        await this.sendPushNotifications(triggeredAlerts, nowIso);
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

  /**
   * Send one push notification per triggered alert. Wrapped so a push
   * failure (missing subscription, dead endpoint, provider error) never
   * breaks the alert-processing run — it's logged and skipped.
   */
  private async sendPushNotifications(
    triggeredAlerts: TriggeredAlert[],
    triggeredAtIso: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    for (const alert of triggeredAlerts) {
      try {
        const badgeCount = await this.alertsService.getUnreadCount(
          alert.user_id,
        );
        const marketName = alert.geography_name || alert.geography_id;
        const directionWord =
          alert.condition === 'below' ? 'dropped below' : 'crossed';

        const result = await this.pushService.sendToUser(alert.user_id, {
          title: `${marketName} alert triggered`,
          body: `${alert.metric_id} ${directionWord} ${alert.threshold} (now ${alert.metric_value})`,
          url: '/alerts',
          badgeCount,
        });

        if (result.sent > 0) {
          const { error: notifiedViaError } = await client
            .from('alert_history')
            .update({ notified_via: 'in-app+push' })
            .eq('alert_id', alert.id)
            .eq('triggered_at', triggeredAtIso);

          if (notifiedViaError) {
            this.logger.error(
              `Failed to mark alert ${alert.id} history as in-app+push: ${notifiedViaError.message}`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `Push notification failed for alert ${alert.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
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
}
