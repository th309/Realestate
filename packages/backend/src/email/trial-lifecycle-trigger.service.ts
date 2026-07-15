import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { EmailTriggerDedupService } from './email-trigger-dedup.service';
import {
  EligibleUser,
  getFutureDayBoundaries,
  getPastDayBoundaries,
} from './behavioral-trigger.utils';
import {
  buildTrialDay10Email,
  buildTrialDay13Email,
  buildTrialExpiredEmail,
} from './behavioral-trigger-emails';
import { getEmailLinkBaseUrl } from './email-link-base';
import { getMarketingOptOutIds } from './email-recipients.util';
import { buildUnsubscribe } from './unsubscribe-link.util';

/** Triggers: trial lifecycle (day 10 reminder, day 13 last-chance, expired). */
@Injectable()
export class TrialLifecycleTriggerService {
  private readonly logger = new Logger(TrialLifecycleTriggerService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly dedup: EmailTriggerDedupService,
  ) {
    this.appUrl = getEmailLinkBaseUrl(this.config);
  }

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
    onlyUserId?: string;
  }): Promise<void> {
    const {
      triggerName,
      subject,
      rangeStart,
      rangeEnd,
      buildHtml,
      actionPath,
      onlyUserId,
    } = opts;

    let query = this.supabase
      .from('user_trials')
      .select('user_id, expires_at')
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gte('expires_at', rangeStart)
      .lt('expires_at', rangeEnd);
    if (onlyUserId) query = query.eq('user_id', onlyUserId);
    const { data: trials, error } = await query;

    if (error) {
      this.logger.error(`${triggerName}: query failed: ${error.message}`);
      return;
    }
    if (!trials?.length) return;

    // user_trials has no FK to user_profiles (both reference auth.users), so a
    // PostgREST embed cannot resolve — fetch emails in a second query.
    const userIds = trials.map((t: { user_id: string }) => t.user_id);
    const { data: profiles, error: profileError } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds);
    if (profileError) {
      this.logger.error(
        `${triggerName}: profile lookup failed: ${profileError.message}`,
      );
      return;
    }
    const users: EligibleUser[] = (profiles ?? [])
      .filter((p: { id: string; email: string | null }) => !!p.email)
      .map((p: { id: string; email: string }) => ({
        id: p.id,
        email: p.email,
      }));
    const optedOutIds = await getMarketingOptOutIds(
      this.supabase,
      users.map((u) => u.id),
    );

    let sent = 0;
    for (const user of users) {
      if (!user.email) continue;
      if (optedOutIds.has(user.id)) continue;
      if (await this.dedup.hasFired(user.id, triggerName)) continue;

      const unsub = buildUnsubscribe(this.config, user.id);
      const html = buildHtml(
        user.email.split('@')[0],
        `${this.appUrl}${actionPath}`,
        unsub?.url ?? `${this.appUrl}/account/notifications`,
      );

      const success = await this.emailService.sendEmail({
        to: user.email,
        subject,
        html,
        userId: user.id,
        emailType: triggerName,
        headers: unsub?.headers,
      });

      if (success) {
        await this.dedup.markFired(user.id, triggerName);
        sent++;
      }
    }

    if (sent > 0) this.logger.log(`${triggerName}: sent ${sent}`);
  }

  /** Users whose trial expires in exactly 4 days. */
  fireTrialDay10(onlyUserId?: string) {
    const { rangeStart, rangeEnd } = getFutureDayBoundaries(4);
    return this.sendToTrialingUsers({
      triggerName: 'trial_day_10',
      subject: '4 days left on your PropertyIQ Pro trial',
      rangeStart,
      rangeEnd,
      buildHtml: buildTrialDay10Email,
      actionPath: '/pricing',
      onlyUserId,
    });
  }

  /** Users whose trial expires tomorrow. */
  fireTrialDay13(onlyUserId?: string) {
    const { rangeStart, rangeEnd } = getFutureDayBoundaries(1);
    return this.sendToTrialingUsers({
      triggerName: 'trial_day_13',
      subject: 'Last chance — your Pro trial ends tomorrow',
      rangeStart,
      rangeEnd,
      buildHtml: buildTrialDay13Email,
      actionPath: '/pricing',
      onlyUserId,
    });
  }

  /** Users whose trial expired yesterday and have not converted to paid. */
  fireTrialExpired(onlyUserId?: string) {
    const { rangeStart, rangeEnd } = getPastDayBoundaries(1);
    return this.sendToTrialingUsers({
      triggerName: 'trial_expired',
      subject: 'Your PropertyIQ Pro trial has ended',
      rangeStart,
      rangeEnd,
      buildHtml: buildTrialExpiredEmail,
      actionPath: '/pricing',
      onlyUserId,
    });
  }
}
