import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { getEmailLinkBaseUrl } from './email-link-base';
import { DRIP_DAY_CONFIGS } from './drip.types';
import type { DripDeps } from './drip.types';
import { processDripDay, runOnboardingDrip } from './drip-onboarding.helper';
import { runWinbackDrip } from './drip-winback.helper';
import { runNpsDrip } from './drip-nps.helper';

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
    this.appUrl = getEmailLinkBaseUrl(this.config);
    this.replyTo =
      this.config.get<string>('EMAIL_REPLY_TO') || 'hello@propertyiq.app';
  }

  private deps(): DripDeps {
    return {
      supabase: this.supabase,
      emailService: this.emailService,
      config: this.config,
      redis: this.redis,
      logger: this.logger,
      appUrl: this.appUrl,
      replyTo: this.replyTo,
    };
  }

  /** Dev/test entry: run a single drip day deterministically (no cron lock). */
  async runDripDay(day: number, onlyUserId?: string) {
    const config = DRIP_DAY_CONFIGS.find((c) => c.day === day);
    if (!config) {
      throw new Error(`No drip config for day ${day}`);
    }
    return processDripDay(this.deps(), config, onlyUserId);
  }

  @Cron('0 9 * * *')
  async processOnboardingDrip() {
    await runOnboardingDrip(this.deps());
  }

  @Cron('0 9 * * *')
  async processWinbackDrip() {
    await runWinbackDrip(this.deps());
  }

  @Cron('0 9 * * *')
  async processNpsDrip() {
    await runNpsDrip(this.deps());
  }
}
