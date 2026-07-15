import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { EmailTriggerDedupService } from './email-trigger-dedup.service';
import { EligibleUser } from './behavioral-trigger.utils';
import { buildInactive24hEmail } from './behavioral-trigger-emails';
import { getEmailLinkBaseUrl } from './email-link-base';
import { getMarketingOptOutIds } from './email-recipients.util';
import { buildUnsubscribe } from './unsubscribe-link.util';

/**
 * Trigger: inactive_24h — users who signed up 24-48 hours ago and have not
 * completed onboarding. "Completed onboarding" is defined as having at
 * least one session recorded.
 */
@Injectable()
export class InactiveUserTriggerService {
  private readonly logger = new Logger(InactiveUserTriggerService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly dedup: EmailTriggerDedupService,
  ) {
    this.appUrl = getEmailLinkBaseUrl(this.config);
  }

  async fireInactive24h(): Promise<void> {
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
    const optedOutIds = await getMarketingOptOutIds(this.supabase, userIds);

    let sent = 0;
    for (const user of candidates as EligibleUser[]) {
      if (!user.email) continue;
      if (activeUserIds.has(user.id)) continue;
      if (optedOutIds.has(user.id)) continue;
      if (await this.dedup.hasFired(user.id, 'inactive_24h')) continue;

      const unsub = buildUnsubscribe(this.config, user.id);
      const html = buildInactive24hEmail(
        user.email.split('@')[0],
        `${this.appUrl}/graphs`,
        unsub?.url ?? `${this.appUrl}/account/notifications`,
      );
      const success = await this.emailService.sendEmail({
        to: user.email,
        subject: 'Your PropertyIQ market data is waiting',
        html,
        userId: user.id,
        emailType: 'inactive_24h',
        headers: unsub?.headers,
      });
      if (success) {
        await this.dedup.markFired(user.id, 'inactive_24h');
        sent++;
      }
    }

    if (sent > 0) this.logger.log(`inactive_24h: sent ${sent}`);
  }
}
