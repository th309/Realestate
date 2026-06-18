import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import {
  EligibleUser,
  extractUsersFromSubscriptions,
  getPastDayBoundaries,
} from './behavioral-trigger.utils';
import {
  buildWelcomeEmail,
  buildActiveExplorerEmail,
  buildReportGeneratedEmail,
  buildPaywallHitEmail,
  buildPostTrial7dEmail,
} from './behavioral-trigger-emails';

@Injectable()
export class EngagementTriggerService {
  private readonly logger = new Logger(EngagementTriggerService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://propertyiq.app';
  }

  async processAll(): Promise<void> {
    await this.fireWelcome();
    await this.fireActiveExplorer();
    await this.fireReportGenerated();
    await this.firePaywallHit();
    await this.firePostTrial7d();
  }

  // ─── Dedup helpers ──────────────────────────────────────────────────────────

  private async hasFired(
    userId: string,
    triggerName: string,
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from('email_triggers')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_name', triggerName)
      .maybeSingle();
    return !!data;
  }

  private async markFired(userId: string, triggerName: string): Promise<void> {
    await this.supabase
      .from('email_triggers')
      .insert({ user_id: userId, trigger_name: triggerName, metadata: {} });
  }

  private async getMarketingOptOutIds(userIds: string[]): Promise<Set<string>> {
    const ids = new Set<string>();
    const { data } = await this.supabase
      .from('email_preferences')
      .select('user_id')
      .in('user_id', userIds)
      .eq('marketing', false);
    if (data) for (const row of data) ids.add(row.user_id);
    return ids;
  }

  // ─── Shared send loop ───────────────────────────────────────────────────────

  private async sendToUsers(
    triggerName: string,
    subject: string,
    users: EligibleUser[],
    buildHtml: (name: string, actionUrl: string, unsubUrl: string) => string,
    actionPath: string,
  ): Promise<void> {
    if (!users.length) return;
    const optedOutIds = await this.getMarketingOptOutIds(
      users.map((u) => u.id),
    );
    const unsubscribeUrl = `${this.appUrl}/account/notifications`;
    let sent = 0;
    for (const user of users) {
      if (!user.email || optedOutIds.has(user.id)) continue;
      if (await this.hasFired(user.id, triggerName)) continue;
      const html = buildHtml(
        user.email.split('@')[0],
        `${this.appUrl}${actionPath}`,
        unsubscribeUrl,
      );
      const ok = await this.emailService.sendEmail({
        to: user.email,
        subject,
        html,
        userId: user.id,
        emailType: triggerName,
      });
      if (ok) {
        await this.markFired(user.id, triggerName);
        sent++;
      }
    }
    if (sent > 0) this.logger.log(`${triggerName}: sent ${sent}`);
  }

  // ─── Trigger: welcome ────────────────────────────────────────────────────────

  /** Users who signed up in the last hour and haven't received a welcome email. */
  async fireWelcome(onlyUserId?: string): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let query = this.supabase
      .from('user_profiles')
      .select('id, email')
      .gte('created_at', cutoff);
    if (onlyUserId) query = query.eq('id', onlyUserId);
    const { data, error } = await query;
    if (error) {
      this.logger.error(`welcome: query failed: ${error.message}`);
      return;
    }
    await this.sendToUsers(
      'welcome',
      "Welcome to PropertyIQ — let's find your first market",
      data ?? [],
      buildWelcomeEmail,
      '/get-started',
    );
  }

  // ─── Trigger: active_explorer ────────────────────────────────────────────────

  /** Users who have checked 3+ scores (tracked via user_feature_usage). */
  private async fireActiveExplorer(): Promise<void> {
    const { data, error } = await this.supabase
      .from('user_feature_usage')
      .select('user_id, user_profiles!inner(id, email)')
      .eq('feature_slug', 'score_view')
      .gte('usage_count', 3);
    if (error) {
      this.logger.error(`active_explorer: query failed: ${error.message}`);
      return;
    }
    const users = extractUsersFromSubscriptions(
      (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        user_profiles: r.user_profiles,
      })),
    );
    await this.sendToUsers(
      'active_explorer',
      'How investors use PropertyIQ Scores to time their purchases',
      users,
      buildActiveExplorerEmail,
      '/graphs',
    );
  }

  // ─── Trigger: report_generated ───────────────────────────────────────────────

  /** Users who have generated at least one report. */
  private async fireReportGenerated(): Promise<void> {
    const { data, error } = await this.supabase
      .from('reports')
      .select('user_id, user_profiles!inner(id, email)')
      .limit(1000);
    if (error) {
      this.logger.error(`report_generated: query failed: ${error.message}`);
      return;
    }
    const seen = new Set<string>();
    const unique = (data ?? []).filter((r: any) => {
      if (seen.has(r.user_id)) return false;
      seen.add(r.user_id);
      return true;
    });
    const users = extractUsersFromSubscriptions(
      unique.map((r: any) => ({
        user_id: r.user_id,
        user_profiles: r.user_profiles,
      })),
    );
    await this.sendToUsers(
      'report_generated',
      "Your market report is ready — here's how to read it",
      users,
      buildReportGeneratedEmail,
      '/reports',
    );
  }

  // ─── Trigger: paywall_hit ────────────────────────────────────────────────────

  /** Users who hit a paywall view in the last 4 hours. */
  private async firePaywallHit(): Promise<void> {
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .from('paywall_events')
      .select('user_id, resource_type, user_profiles!inner(id, email)')
      .eq('event_type', 'view')
      .gte('created_at', cutoff);
    if (error) {
      this.logger.error(`paywall_hit: query failed: ${error.message}`);
      return;
    }
    const unsubscribeUrl = `${this.appUrl}/account/notifications`;
    const optedOutIds = await this.getMarketingOptOutIds(
      (data ?? []).map((r: any) => r.user_id),
    );
    let sent = 0;
    for (const row of data ?? []) {
      const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;
      if (!profile?.email || optedOutIds.has(row.user_id)) continue;
      if (await this.hasFired(row.user_id, 'paywall_hit')) continue;
      const featureName = row.resource_type ?? 'this Pro feature';
      const html = buildPaywallHitEmail(
        profile.email.split('@')[0],
        featureName,
        `${this.appUrl}/pricing`,
        unsubscribeUrl,
      );
      const ok = await this.emailService.sendEmail({
        to: profile.email,
        subject: `Unlock ${featureName} and more with PropertyIQ Pro`,
        html,
        userId: row.user_id,
        emailType: 'paywall_hit',
      });
      if (ok) {
        await this.markFired(row.user_id, 'paywall_hit');
        sent++;
      }
    }
    if (sent > 0) this.logger.log(`paywall_hit: sent ${sent}`);
  }

  // ─── Trigger: post_trial_7d ──────────────────────────────────────────────────

  /**
   * Users whose trial expired exactly 7 days ago without converting.
   * NOTE: Reminder shown regardless of free_report_credits — that column does not
   * exist on user_profiles. Add the credits filter once the column is available.
   */
  private async firePostTrial7d(): Promise<void> {
    const { rangeStart, rangeEnd } = getPastDayBoundaries(7);
    const { data, error } = await this.supabase
      .from('user_trials')
      .select('user_id, user_profiles!inner(id, email)')
      .gte('expires_at', rangeStart)
      .lt('expires_at', rangeEnd)
      .is('converted_at', null);
    if (error) {
      this.logger.error(`post_trial_7d: query failed: ${error.message}`);
      return;
    }
    const users = extractUsersFromSubscriptions(
      (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        user_profiles: r.user_profiles,
      })),
    );
    const unsubUrl = `${this.appUrl}/account/notifications`;
    const optedOutIds = await this.getMarketingOptOutIds(
      users.map((u) => u.id),
    );
    let sent = 0;
    for (const user of users) {
      if (!user.email || optedOutIds.has(user.id)) continue;
      if (await this.hasFired(user.id, 'post_trial_7d')) continue;
      const html = buildPostTrial7dEmail(
        user.email.split('@')[0],
        `${this.appUrl}/reports`,
        `${this.appUrl}/pricing`,
        unsubUrl,
      );
      const ok = await this.emailService.sendEmail({
        to: user.email,
        subject: 'Your free report credit is waiting',
        html,
        userId: user.id,
        emailType: 'post_trial_7d',
      });
      if (ok) {
        await this.markFired(user.id, 'post_trial_7d');
        sent++;
      }
    }
    if (sent > 0) this.logger.log(`post_trial_7d: sent ${sent}`);
  }
}
