import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  OnboardingDay0Welcome,
  OnboardingDay1Scores,
  OnboardingDay3Compare,
  OnboardingDay7Profile,
  OnboardingDay14Report,
} from '@propertyiq/emails';
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
    | typeof OnboardingDay7Profile
    | typeof OnboardingDay14Report;
}

const DRIP_DAY_CONFIGS: DripDayConfig[] = [
  {
    day: 0,
    emailType: 'onboarding_day0',
    subject: 'Welcome to PropertyIQ — start exploring',
    template: OnboardingDay0Welcome,
  },
  {
    day: 1,
    emailType: 'onboarding_day1',
    subject: 'How to read your PropertyIQ scores',
    template: OnboardingDay1Scores,
  },
  {
    day: 3,
    emailType: 'onboarding_day3',
    subject: 'Compare markets side by side',
    template: OnboardingDay3Compare,
  },
  {
    day: 7,
    emailType: 'onboarding_day7',
    subject: 'Get personalized market recommendations',
    template: OnboardingDay7Profile,
  },
  {
    day: 14,
    emailType: 'onboarding_day14',
    subject: 'Your first market report is on us',
    template: OnboardingDay14Report,
  },
];

@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly redis: RedisLockService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') || 'https://propertyiq.app';
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

      try {
        const displayName = user.email.split('@')[0];
        const react = React.createElement(dayConfig.template, {
          name: displayName,
          loginUrl: this.appUrl,
        });

        const success = await this.emailService.sendEmail({
          to: user.email,
          subject: dayConfig.subject,
          react,
          userId: user.id,
          emailType: dayConfig.emailType,
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
