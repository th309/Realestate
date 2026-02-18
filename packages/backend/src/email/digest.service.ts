import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
  ) {}

  @Cron('0 8 * * MON')
  async sendWeeklyDigests() {
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

        const html = this.renderDigestEmail(digestData);

        const success = await this.emailService.sendEmail({
          to: user.email,
          subject: `PropertyIQ Weekly Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          html,
          userId: user.id,
          emailType: 'digest',
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

    // Fetch alerts triggered in past 7 days
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: alertHistory } = await this.supabase
      .from('alert_history')
      .select(
        '*, alert:user_alerts(geography_name, metric_id, condition, threshold)',
      )
      .gte('triggered_at', sevenDaysAgo)
      .order('triggered_at', { ascending: false })
      .limit(10);

    // Filter to user's alerts
    const userAlertHistory = alertHistory?.filter((h) => h.alert) || [];

    return {
      watchlist: watchlist || [],
      watchlistCount: watchlist?.length || 0,
      alerts: userAlertHistory,
      alertCount: userAlertHistory.length,
      hasContent: (watchlist?.length || 0) > 0 || userAlertHistory.length > 0,
    };
  }

  private renderDigestEmail(data: {
    watchlist: Array<{
      geography_name?: string;
      geography_id: string;
      geography_type: string;
    }>;
    alerts: Array<{
      alert?: {
        geography_name?: string;
        metric_id?: string;
        condition?: string;
        threshold?: number;
      };
      metric_value?: number;
    }>;
    watchlistCount: number;
    alertCount: number;
    hasContent: boolean;
  }): string {
    const watchlistSection =
      data.watchlist.length > 0
        ? `
        <h2 style="font-size: 18px; color: #1a1a1a; margin-top: 24px;">Your Markets</h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${data.watchlist
            .map(
              (m) => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0;">
                <strong style="color: #1a1a1a;">${m.geography_name || m.geography_id}</strong>
                <br><span style="font-size: 12px; color: #666;">${m.geography_type}</span>
              </td>
            </tr>
          `,
            )
            .join('')}
        </table>
      `
        : '';

    const alertsSection =
      data.alerts.length > 0
        ? `
        <h2 style="font-size: 18px; color: #1a1a1a; margin-top: 24px;">Triggered Alerts (Past 7 Days)</h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${data.alerts
            .map(
              (a) => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0;">
                <strong style="color: #1a1a1a;">${a.alert?.geography_name || 'Market'}</strong>
                <br><span style="font-size: 12px; color: #666;">${a.alert?.metric_id} ${a.alert?.condition} ${a.alert?.threshold} — Current: ${a.metric_value}</span>
              </td>
            </tr>
          `,
            )
            .join('')}
        </table>
      `
        : '';

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #6750A4;">
          <h1 style="font-size: 24px; color: #6750A4; margin: 0;">PropertyIQ</h1>
          <p style="font-size: 14px; color: #666; margin: 4px 0 0;">Weekly Market Digest</p>
        </div>

        ${watchlistSection}
        ${alertsSection}

        <div style="margin-top: 32px; padding: 16px; background: #f5f3ff; border-radius: 8px; text-align: center;">
          <a href="https://propertyiq.io/dashboard" style="color: #6750A4; font-weight: 600; text-decoration: none;">
            View Your Dashboard →
          </a>
        </div>

        <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 11px; color: #999; text-align: center;">
          You're receiving this because you have a PropertyIQ Pro subscription.
          <a href="https://propertyiq.io/account/notifications" style="color: #999;">Manage preferences</a>
        </p>
      </body>
      </html>
    `;
  }
}
