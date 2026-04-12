import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  OnboardingDay0Welcome,
  OnboardingDay1Scores,
  OnboardingDay3Compare,
  OnboardingDay5Upgrade,
  OnboardingDay7Profile,
  OnboardingDay10Zillow,
  OnboardingDay14Report,
  WinbackDay14,
  NpsDay30,
} from '@propertyiq/emails';
import { signNpsToken } from '../surveys/nps-token.util';
import React from 'react';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { RedisLockService } from '../redis/redis-lock.service';

interface DripDayConfig {
  day: number;
  emailType: string;
  subject: string;
  template:
    | typeof OnboardingDay0Welcome
    | typeof OnboardingDay1Scores
    | typeof OnboardingDay3Compare
    | typeof OnboardingDay5Upgrade
    | typeof OnboardingDay7Profile
    | typeof OnboardingDay10Zillow
    | typeof OnboardingDay14Report;
}

const DRIP_DAY_CONFIGS: DripDayConfig[] = [
  {
    day: 0,
    emailType: 'onboarding_day0',
    subject: 'Your free PropertyIQ Score is ready',
    template: OnboardingDay0Welcome,
  },
  {
    day: 1,
    emailType: 'onboarding_day1',
    subject: 'What does a 74 actually mean?',
    template: OnboardingDay1Scores,
  },
  {
    day: 3,
    emailType: 'onboarding_day3',
    subject: 'How investors are using PropertyIQ to find their next market',
    template: OnboardingDay3Compare,
  },
  {
    day: 5,
    emailType: 'onboarding_day5',
    // NOTE: CMO provides updated market data for this email each month.
    // Update the template body copy in onboarding-day5-upgrade.tsx with the new top movers.
    subject: 'The 5 markets that moved the most this month',
    template: OnboardingDay5Upgrade,
  },
  {
    day: 7,
    emailType: 'onboarding_day7',
    subject: 'What Pro users see that free users miss',
    template: OnboardingDay7Profile,
  },
  {
    day: 10,
    emailType: 'onboarding_day10',
    subject: 'I already use Zillow for this.',
    template: OnboardingDay10Zillow,
  },
  {
    day: 14,
    emailType: 'onboarding_day14',
    subject: 'One thing before you go',
    template: OnboardingDay14Report,
  },
];

@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);
  private readonly appUrl: string;
  private readonly replyTo: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly redis: RedisLockService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') || 'https://propertyiq.app';
    this.replyTo =
      this.config.get<string>('EMAIL_REPLY_TO') || 'hello@propertyiq.app';
  }

  @Cron('0 9 * * *')
  async processOnboardingDrip() {
    const locked = await this.redis.acquireLock('cron:onboarding-drip', 300);
    if (!locked) {
      this.logger.log(
        'Another instance is processing onboarding drip, skipping',
      );
      return;
    }

    try {
      this.logger.log('Starting onboarding drip processing...');

      let totalSent = 0;
      let totalSkipped = 0;
      let totalFailed = 0;

      for (const dayConfig of DRIP_DAY_CONFIGS) {
        const { sent, skipped, failed } = await this.processDripDay(dayConfig);
        totalSent += sent;
        totalSkipped += skipped;
        totalFailed += failed;
      }

      this.logger.log(
        `Onboarding drip complete. Sent: ${totalSent}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`,
      );
    } finally {
      await this.redis.releaseLock('cron:onboarding-drip');
    }
  }

  private async processDripDay(
    dayConfig: DripDayConfig,
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    const { startOfDay, endOfDay } = this.getDayBoundariesUTC(dayConfig.day);

    const { data: eligibleUsers, error: queryError } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay);

    if (queryError) {
      this.logger.error(
        `Failed to query users for day ${dayConfig.day}: ${queryError.message}`,
      );
      return { sent, skipped, failed };
    }

    if (!eligibleUsers?.length) {
      return { sent, skipped, failed };
    }

    // Batch-check which users already received this email
    const userIds = eligibleUsers.map((u) => u.id);
    const alreadySentIds = await this.getAlreadySentUserIds(
      userIds,
      dayConfig.emailType,
    );

    // Check for users who opted out of marketing emails
    const optedOutIds = await this.getMarketingOptOutIds(userIds);

    for (const user of eligibleUsers) {
      if (!user.email) {
        skipped++;
        continue;
      }

      if (alreadySentIds.has(user.id)) {
        skipped++;
        continue;
      }

      if (optedOutIds.has(user.id)) {
        skipped++;
        continue;
      }

      // Skip users with active reverse trial — they get behavioral emails instead
      const { data: activeTrial } = await this.supabase
        .from('user_trials')
        .select('id')
        .eq('user_id', user.id)
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (activeTrial) {
        skipped++;
        continue;
      }

      try {
        const displayName = user.email.split('@')[0];
        const unsubscribeUrl = `${this.appUrl}/account/notifications`;
        const react = React.createElement(dayConfig.template, {
          name: displayName,
          loginUrl: this.appUrl,
          unsubscribeUrl,
        });

        const success = await this.emailService.sendEmail({
          to: user.email,
          subject: dayConfig.subject,
          react,
          userId: user.id,
          emailType: dayConfig.emailType,
          replyTo: this.replyTo,
        });

        if (success) {
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        this.logger.error(
          `Failed drip ${dayConfig.emailType} for user ${user.id}:`,
          err,
        );
        failed++;
      }
    }

    if (sent > 0) {
      this.logger.log(
        `Day ${dayConfig.day} (${dayConfig.emailType}): sent ${sent}, skipped ${skipped}, failed ${failed}`,
      );
    }

    return { sent, skipped, failed };
  }

  @Cron('0 9 * * *')
  async processWinbackDrip() {
    const locked = await this.redis.acquireLock('cron:winback-drip', 300);
    if (!locked) {
      this.logger.log('Another instance is processing winback drip, skipping');
      return;
    }

    try {
      this.logger.log('Starting win-back drip processing...');

      // Find users whose last activity was exactly 14 days ago with 3+ sessions
      const churnCutoffStart = new Date(
        Date.now() - 15 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const churnCutoffEnd = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Get user sessions with last activity in the 14-day window
      const { data: sessions, error: sessionsError } = await this.supabase
        .from('user_sessions')
        .select('user_id, last_activity_at')
        .not('user_id', 'is', null)
        .gte('last_activity_at', churnCutoffStart)
        .lt('last_activity_at', churnCutoffEnd);

      if (sessionsError) {
        this.logger.error(
          `Win-back: session query failed: ${sessionsError.message}`,
        );
        return;
      }

      if (!sessions?.length) {
        this.logger.log('Win-back: no eligible users found');
        return;
      }

      // Count sessions per user — only send to users with 3+ sessions
      const sessionCountByUser = new Map<string, number>();
      for (const row of sessions) {
        sessionCountByUser.set(
          row.user_id,
          (sessionCountByUser.get(row.user_id) ?? 0) + 1,
        );
      }

      const eligibleUserIds = Array.from(sessionCountByUser.entries())
        .filter(([, count]) => count >= 3)
        .map(([userId]) => userId);

      if (!eligibleUserIds.length) {
        this.logger.log('Win-back: no users with 3+ sessions found');
        return;
      }

      // Get emails for eligible users
      const { data: profiles, error: profilesError } = await this.supabase
        .from('user_profiles')
        .select('id, email')
        .in('id', eligibleUserIds);

      if (profilesError || !profiles?.length) {
        this.logger.log('Win-back: no user profiles found for eligible users');
        return;
      }

      const alreadySentIds = await this.getAlreadySentUserIds(
        eligibleUserIds,
        'winback_day14',
      );
      const optedOutIds = await this.getMarketingOptOutIds(eligibleUserIds);

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const user of profiles) {
        if (
          !user.email ||
          alreadySentIds.has(user.id) ||
          optedOutIds.has(user.id)
        ) {
          skipped++;
          continue;
        }

        try {
          const displayName = user.email.split('@')[0];
          const react = React.createElement(WinbackDay14, {
            name: displayName,
            loginUrl: this.appUrl,
          });

          const success = await this.emailService.sendEmail({
            to: user.email,
            subject: 'Markets have moved since you last checked in',
            react,
            userId: user.id,
            emailType: 'winback_day14',
          });

          if (success) sent++;
          else failed++;
        } catch (err) {
          this.logger.error(`Win-back failed for user ${user.id}:`, err);
          failed++;
        }
      }

      this.logger.log(
        `Win-back drip complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`,
      );
    } finally {
      await this.redis.releaseLock('cron:winback-drip');
    }
  }

  @Cron('0 9 * * *')
  async processNpsDrip() {
    const locked = await this.redis.acquireLock('cron:nps-drip', 300);
    if (!locked) {
      this.logger.log('Another instance is processing NPS drip, skipping');
      return;
    }

    try {
      const jwtSecret = this.config.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        this.logger.error('NPS drip: JWT_SECRET not configured');
        return;
      }

      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') || 'https://propertyiq.app';
      const surveyBaseUrl = `${frontendUrl}/survey`;

      this.logger.log('Starting NPS day-30 drip processing...');

      const { startOfDay, endOfDay } = this.getDayBoundariesUTC(30);

      const { data: eligibleUsers, error: queryError } = await this.supabase
        .from('user_profiles')
        .select('id, email')
        .gte('created_at', startOfDay)
        .lt('created_at', endOfDay);

      if (queryError) {
        this.logger.error(`NPS drip: user query failed: ${queryError.message}`);
        return;
      }

      if (!eligibleUsers?.length) {
        this.logger.log('NPS drip: no eligible users for day 30');
        return;
      }

      const userIds = eligibleUsers.map((u) => u.id);
      const alreadySentIds = await this.getAlreadySentUserIds(
        userIds,
        'nps_day30',
      );
      const optedOutIds = await this.getMarketingOptOutIds(userIds);

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const user of eligibleUsers) {
        if (
          !user.email ||
          alreadySentIds.has(user.id) ||
          optedOutIds.has(user.id)
        ) {
          skipped++;
          continue;
        }

        try {
          const token = signNpsToken(user.id, 'nps_day30', jwtSecret);
          const displayName = user.email.split('@')[0];
          const react = React.createElement(NpsDay30, {
            name: displayName,
            surveyBaseUrl,
            token,
          });

          const success = await this.emailService.sendEmail({
            to: user.email,
            subject: 'How likely are you to recommend PropertyIQ? (30 seconds)',
            react,
            userId: user.id,
            emailType: 'nps_day30',
          });

          if (success) sent++;
          else failed++;
        } catch (err) {
          this.logger.error(`NPS drip failed for user ${user.id}:`, err);
          failed++;
        }
      }

      this.logger.log(
        `NPS day-30 drip complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`,
      );
    } finally {
      await this.redis.releaseLock('cron:nps-drip');
    }
  }

  private getDayBoundariesUTC(daysAgo: number): {
    startOfDay: string;
    endOfDay: string;
  } {
    const now = new Date();
    const target = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysAgo,
      ),
    );

    const startOfDay = target.toISOString();

    const end = new Date(target);
    end.setUTCDate(end.getUTCDate() + 1);
    const endOfDay = end.toISOString();

    return { startOfDay, endOfDay };
  }

  private async getAlreadySentUserIds(
    userIds: string[],
    emailType: string,
  ): Promise<Set<string>> {
    const sentIds = new Set<string>();

    const { data } = await this.supabase
      .from('email_log')
      .select('user_id')
      .in('user_id', userIds)
      .eq('email_type', emailType);

    if (data) {
      for (const row of data) sentIds.add(row.user_id);
    }

    return sentIds;
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
}
