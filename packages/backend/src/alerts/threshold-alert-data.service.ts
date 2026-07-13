/**
 * Threshold Alert Data Service
 *
 * Handles all DB queries for the threshold alert system:
 * - Fetching active score-based alerts
 * - Batch-fetching latest scores from propertyiq_scores
 * - Batch-fetching user emails with opt-out filtering
 * - Recording trigger history
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import {
  ActiveAlert,
  ScoreRow,
  SCORE_METRIC_COLUMNS,
} from './threshold-alert.types';

@Injectable()
export class ThresholdAlertDataService {
  private readonly logger = new Logger(ThresholdAlertDataService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fetch all active alerts whose metric_id maps to a score column.
   *
   * Schema note: `user_alerts`' live DB columns are `metric_name` /
   * `condition_type` / `threshold_value`, NOT `metric_id`/`condition`/
   * `threshold` (verified via `information_schema.columns` against the live
   * table, 2026-07-12 — no ALTER migration for this table exists anywhere in
   * the repo). Aliased in the select so `ActiveAlert`'s public field names —
   * and every downstream consumer in threshold-alert.service.ts — are
   * unaffected.
   */
  async fetchActiveScoreAlerts(): Promise<ActiveAlert[]> {
    const scoreMetricIds = Object.keys(SCORE_METRIC_COLUMNS);

    const { data, error } = await this.supabase
      .from('user_alerts')
      .select(
        'id, user_id, geography_type, geography_id, geography_name, metric_id:metric_name, condition:condition_type, threshold:threshold_value, last_triggered_at',
      )
      .eq('is_active', true)
      .in('metric_name', scoreMetricIds);

    if (error) {
      this.logger.error(`Failed to fetch active alerts: ${error.message}`);
      return [];
    }

    return (data as ActiveAlert[]) || [];
  }

  /**
   * Batch-fetch latest scores for all unique geography combos.
   * Returns Map keyed by "geoType:geoId" -> ScoreRow.
   */
  async batchFetchScores(
    alerts: ActiveAlert[],
  ): Promise<Map<string, ScoreRow>> {
    // Group alerts by geography type for efficient batching
    const byType = new Map<string, Set<string>>();
    for (const alert of alerts) {
      const ids = byType.get(alert.geography_type) || new Set();
      ids.add(alert.geography_id);
      byType.set(alert.geography_type, ids);
    }

    const scoreMap = new Map<string, ScoreRow>();

    for (const [geoType, geoIdSet] of byType) {
      const geoIds = [...geoIdSet];
      const { data, error } = await this.supabase
        .from('propertyiq_scores')
        .select('geography_id, propertyiq_score')
        .eq('geography_type', geoType)
        .in('geography_id', geoIds)
        .order('period_date', { ascending: false })
        .limit(geoIds.length);

      if (error) {
        this.logger.error(
          `Failed to fetch scores for ${geoType}: ${error.message}`,
        );
        continue;
      }

      // Keep only the latest row per geography_id (ordered by period_date desc)
      const seen = new Set<string>();
      for (const row of data || []) {
        if (!seen.has(row.geography_id)) {
          seen.add(row.geography_id);
          scoreMap.set(`${geoType}:${row.geography_id}`, row as ScoreRow);
        }
      }
    }

    return scoreMap;
  }

  /**
   * Batch-fetch user emails, filtering out users who opted out of alert emails.
   * Returns Map keyed by user_id -> email (null if opted out or missing).
   */
  async batchFetchUserEmails(
    alerts: ActiveAlert[],
  ): Promise<Map<string, string | null>> {
    const uniqueUserIds = [...new Set(alerts.map((a) => a.user_id))];
    const emailMap = new Map<string, string | null>();

    const { data: profiles } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', uniqueUserIds);

    for (const profile of profiles || []) {
      emailMap.set(profile.id, profile.email || null);
    }

    // Null out users who opted out of alert emails
    const { data: optedOut } = await this.supabase
      .from('email_preferences')
      .select('user_id')
      .in('user_id', uniqueUserIds)
      .eq('alert_emails', false);

    for (const row of optedOut || []) {
      emailMap.set(row.user_id, null);
    }

    return emailMap;
  }

  /**
   * Insert alert_history entry and update last_triggered_at on the alert.
   */
  async recordTrigger(alertId: string, metricValue: number): Promise<void> {
    const now = new Date().toISOString();

    const { error: historyError } = await this.supabase
      .from('alert_history')
      .insert({
        alert_id: alertId,
        metric_value: metricValue,
        notified_via: 'email',
        triggered_at: now,
      });

    if (historyError) {
      this.logger.error(
        `Failed to insert alert_history for ${alertId}: ${historyError.message}`,
      );
    }

    const { error: updateError } = await this.supabase
      .from('user_alerts')
      .update({ last_triggered_at: now })
      .eq('id', alertId);

    if (updateError) {
      this.logger.error(
        `Failed to update last_triggered_at for ${alertId}: ${updateError.message}`,
      );
    }
  }
}
