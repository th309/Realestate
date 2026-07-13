import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { WeeklyDigest } from '@propertyiq/emails';
import React from 'react';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { getEmailLinkBaseUrl } from './email-link-base';
import { buildUnsubscribe } from './unsubscribe-link.util';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly redis: RedisLockService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = getEmailLinkBaseUrl(this.config);
  }

  @Cron('0 8 * * MON')
  async sendWeeklyDigests() {
    const locked = await this.redis.acquireLock('cron:weekly-digest', 600);
    if (!locked) {
      this.logger.log('Another instance is processing weekly digest, skipping');
      return;
    }

    try {
      await this.sendWeeklyDigestsInner();
    } finally {
      await this.redis.releaseLock('cron:weekly-digest');
    }
  }

  private async sendWeeklyDigestsInner() {
    this.logger.log('Starting weekly digest processing...');

    // 1. Get all pro/enterprise users with active subscriptions
    const { data: allProUsers } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active');

    if (!allProUsers?.length) {
      this.logger.log('No pro users found for digest');
      return;
    }

    // 2. Get users who explicitly opted out
    const optedOutIds = new Set<string>();
    const { data: optedOut } = await this.supabase
      .from('email_preferences')
      .select('user_id')
      .eq('weekly_digest', false);

    if (optedOut) {
      for (const row of optedOut) optedOutIds.add(row.user_id);
    }

    let sent = 0;
    let failed = 0;

    for (const user of allProUsers) {
      if (optedOutIds.has(user.id)) continue;
      if (!user.email) continue;

      try {
        const digestData = await this.buildDigestData(user.id);
        if (!digestData.hasContent) continue;

        // Weekly digest is gated on the `weekly_digest` preference, so its
        // one-click unsubscribe must flip THAT stream (not `marketing`).
        const unsub = buildUnsubscribe(this.config, user.id, 'weekly_digest');
        const react = React.createElement(WeeklyDigest, {
          name: user.email.split('@')[0],
          watchlist: digestData.watchlist.map((m) => ({
            name: m.geography_name || m.geography_id,
            geoType: m.geography_type,
            geoId: m.geography_id,
          })),
          alerts: digestData.alerts.map((a) => ({
            marketName: a.alert?.geography_name || 'Market',
            metricId: a.alert?.metric_id || '',
            condition: a.alert?.condition || '',
            threshold: a.alert?.threshold || 0,
            currentValue: a.metric_value || 0,
          })),
          dashboardUrl: `${this.appUrl}/dashboard`,
          preferencesUrl: unsub?.url ?? `${this.appUrl}/account/notifications`,
        });

        const success = await this.emailService.sendEmail({
          to: user.email,
          subject: `PropertyIQ Weekly Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          react,
          userId: user.id,
          emailType: 'digest',
          headers: unsub?.headers,
          metadata: {
            watchlistCount: digestData.watchlistCount,
            alertCount: digestData.alertCount,
          },
        });

        if (success) sent++;
        else failed++;
      } catch (err) {
        this.logger.error(`Failed digest for user ${user.id}:`, err);
        failed++;
      }
    }

    this.logger.log(`Weekly digest complete. Sent: ${sent}, Failed: ${failed}`);
  }

  private async buildDigestData(userId: string) {
    // Fetch watchlist
    const { data: watchlist } = await this.supabase
      .from('analytics_watchlist')
      .select('geography_type, geography_id, geography_name')
      .eq('user_id', userId)
      .limit(10);

    // Fetch the user's alert IDs first, then scope alert_history to them
    const { data: userAlerts } = await this.supabase
      .from('user_alerts')
      .select('id')
      .eq('user_id', userId);

    const userAlertIds = userAlerts?.map((a) => a.id) || [];

    let userAlertHistory: Array<{
      alert?: {
        geography_name?: string;
        metric_id?: string;
        condition?: string;
        threshold?: number;
      };
      metric_value?: number;
    }> = [];

    if (userAlertIds.length > 0) {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      // user_alerts' live columns are metric_name/condition_type/threshold_value;
      // alias them back to the public shape (same mapping as
      // alerts.service.ts's USER_ALERT_SELECT_COLUMNS). The dead names made
      // PostgREST 42703 here, silently emptying the digest's alerts section.
      const { data: alertHistory, error: alertHistoryError } =
        await this.supabase
          .from('alert_history')
          .select(
            '*, alert:user_alerts(geography_name, metric_id:metric_name, condition:condition_type, threshold:threshold_value)',
          )
          .in('alert_id', userAlertIds)
          .gte('triggered_at', sevenDaysAgo)
          .order('triggered_at', { ascending: false })
          .limit(10);

      if (alertHistoryError) {
        this.logger.warn(
          `Digest alert-history query failed: ${alertHistoryError.message}`,
        );
      }
      userAlertHistory = alertHistory?.filter((h) => h.alert) || [];
    }

    return {
      watchlist: watchlist || [],
      watchlistCount: watchlist?.length || 0,
      alerts: userAlertHistory,
      alertCount: userAlertHistory.length,
      hasContent: (watchlist?.length || 0) > 0 || userAlertHistory.length > 0,
    };
  }
}
