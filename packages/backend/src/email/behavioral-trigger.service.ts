import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { RedisLockService } from '../redis/redis-lock.service';
import {
  EligibleUser,
  getFutureDayBoundaries,
  getPastDayBoundaries,
  extractUsersFromSubscriptions,
} from './behavioral-trigger.utils';
import {
  buildInactive24hEmail,
  buildTrialDay10Email,
  buildTrialDay13Email,
  buildTrialExpiredEmail,
} from './behavioral-trigger-emails';

@Injectable()
export class BehavioralTriggerService {
  private readonly logger = new Logger(BehavioralTriggerService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly lockService: RedisLockService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://propertyiq.app';
  }

  @Cron('0 * * * *') // Every hour
  async processTriggersHourly() {
    const locked = await this.lockService.acquireLock(
      'cron:behavioral-triggers',
      300,
    );
    if (!locked) {
      this.logger.log(
        'Another instance is processing behavioral triggers, skipping',
      );
      return;
    }
    try {
      this.logger.log('Starting behavioral trigger processing...');
      await this.fireInactive24h();
      await this.fireTrialDay10();
      await this.fireTrialDay13();
      await this.fireTrialExpired();
      this.logger.log('Behavioral trigger processing complete.');
    } finally {
      await this.lockService.releaseLock('cron:behavioral-triggers');
    }
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
    const optedOutIds = new Set<string>();
    const { data } = await this.supabase
      .from('email_preferences')
      .select('user_id')
      .in('user_id', userIds)
      .eq('marketing', false);
    if (data) {
      for (const row of data) optedOutIds.add(row.user_id);
    }
    return optedOutIds;
  }

  // ─── Shared send loop for subscription-based triggers ───────────────────────

  private async sendToTrialingUsers(opts: {
    triggerName: string;
    subject: string;
    rangeStart: string;
    rangeEnd: string;
    buildHtml: (
      name: string,
      actionUrl: string,
      unsubscribeUrl: string,
    ) => string;
    actionPath: string;
  }): Promise<void> {
    const {
      triggerName,
      subject,
      rangeStart,
      rangeEnd,
      buildHtml,
      actionPath,
    } = opts;

    const { data: candidates, error } = await this.supabase
      .from('user_subscriptions')
      .select('user_id, trial_ends_at, user_profiles(id, email)')
      .eq('status', 'trialing')
      .gte('trial_ends_at', rangeStart)
      .lt('trial_ends_at', rangeEnd);

    if (error) {
      this.logger.error(`${triggerName}: query failed: ${error.message}`);
      return;
    }
    if (!candidates?.length) return;

    const users = extractUsersFromSubscriptions(candidates);
    const optedOutIds = await this.getMarketingOptOutIds(
      users.map((u) => u.id),
    );
    const unsubscribeUrl = `${this.appUrl}/account/notifications`;

    let sent = 0;
    for (const user of users) {
      if (!user.email) continue;
      if (optedOutIds.has(user.id)) continue;
      if (await this.hasFired(user.id, triggerName)) continue;

      const html = buildHtml(
        user.email.split('@')[0],
        `${this.appUrl}${actionPath}`,
        unsubscribeUrl,
      );

      const success = await this.emailService.sendEmail({
        to: user.email,
        subject,
        html,
        userId: user.id,
        emailType: triggerName,
      });

      if (success) {
        await this.markFired(user.id, triggerName);
        sent++;
      }
    }

    if (sent > 0) this.logger.log(`${triggerName}: sent ${sent}`);
  }

  // ─── Trigger: inactive_24h ──────────────────────────────────────────────────

  /**
   * Users who signed up 24–48 hours ago and have not completed onboarding.
   * "Completed onboarding" is defined as having at least one session recorded.
   */
  private async fireInactive24h(): Promise<void> {
    const now = new Date();
    const cutoffStart = new Date(
      now.getTime() - 48 * 60 * 60 * 1000,
    ).toISOString();
    const cutoffEnd = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: candidates, error } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .gte('created_at', cutoffStart)
      .lt('created_at', cutoffEnd);

    if (error) {
      this.logger.error(`inactive_24h: user query failed: ${error.message}`);
      return;
    }
    if (!candidates?.length) return;

    const userIds = candidates.map((u: EligibleUser) => u.id);
    const { data: sessions } = await this.supabase
      .from('user_sessions')
      .select('user_id')
      .in('user_id', userIds);

    const activeUserIds = new Set<string>(
      (sessions ?? []).map((s: { user_id: string }) => s.user_id),
    );
    const optedOutIds = await this.getMarketingOptOutIds(userIds);
    const unsubscribeUrl = `${this.appUrl}/account/notifications`;

    let sent = 0;
    for (const user of candidates as EligibleUser[]) {
      if (!user.email) continue;
      if (activeUserIds.has(user.id)) continue;
      if (optedOutIds.has(user.id)) continue;
      if (await this.hasFired(user.id, 'inactive_24h')) continue;

      const html = buildInactive24hEmail(
        user.email.split('@')[0],
        `${this.appUrl}/graphs`,
        unsubscribeUrl,
      );
      const success = await this.emailService.sendEmail({
        to: user.email,
        subject: 'Your PropertyIQ market data is waiting',
        html,
        userId: user.id,
        emailType: 'inactive_24h',
      });
      if (success) {
        await this.markFired(user.id, 'inactive_24h');
        sent++;
      }
    }

    if (sent > 0) this.logger.log(`inactive_24h: sent ${sent}`);
  }

  // ─── Triggers: trial lifecycle ───────────────────────────────────────────────

  /** Users whose trial expires in exactly 4 days. */
  private fireTrialDay10() {
    const { rangeStart, rangeEnd } = getFutureDayBoundaries(4);
    return this.sendToTrialingUsers({
      triggerName: 'trial_day_10',
      subject: '4 days left on your PropertyIQ Pro trial',
      rangeStart,
      rangeEnd,
      buildHtml: buildTrialDay10Email,
      actionPath: '/pricing',
    });
  }

  /** Users whose trial expires tomorrow. */
  private fireTrialDay13() {
    const { rangeStart, rangeEnd } = getFutureDayBoundaries(1);
    return this.sendToTrialingUsers({
      triggerName: 'trial_day_13',
      subject: 'Last chance — your Pro trial ends tomorrow',
      rangeStart,
      rangeEnd,
      buildHtml: buildTrialDay13Email,
      actionPath: '/pricing',
    });
  }

  /** Users whose trial expired yesterday and have not converted to paid. */
  private fireTrialExpired() {
    const { rangeStart, rangeEnd } = getPastDayBoundaries(1);
    return this.sendToTrialingUsers({
      triggerName: 'trial_expired',
      subject: 'Your PropertyIQ Pro trial has ended',
      rangeStart,
      rangeEnd,
      buildHtml: buildTrialExpiredEmail,
      actionPath: '/pricing',
    });
  }
}
