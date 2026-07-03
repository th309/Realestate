import type { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  OnboardingDay0Welcome,
  OnboardingDay1Scores,
  OnboardingDay3Compare,
  OnboardingDay5Upgrade,
  OnboardingDay7Profile,
  OnboardingDay10Zillow,
  OnboardingDay14Report,
} from '@propertyiq/emails';
import type { EmailService } from './email.service';
import type { RedisLockService } from '../redis/redis-lock.service';

export interface DripDayConfig {
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

/** Shared runtime dependencies passed to the extracted drip processors. */
export interface DripDeps {
  supabase: SupabaseClient;
  emailService: EmailService;
  config: ConfigService;
  redis: RedisLockService;
  logger: Logger;
  appUrl: string;
  replyTo: string;
}

export const DRIP_DAY_CONFIGS: DripDayConfig[] = [
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
