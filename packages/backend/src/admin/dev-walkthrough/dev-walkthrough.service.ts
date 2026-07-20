import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { DripService } from '../../email/drip.service';
import { TrialLifecycleTriggerService } from '../../email/trial-lifecycle-trigger.service';
import { EngagementTriggerService } from '../../email/engagement-trigger.service';
import { UsersService } from '../users/users.service';

const TRIAL_DAYS = 14;

function utcNoonOffset(days: number): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + days,
      12,
      0,
      0,
    ),
  );
  return d;
}

@Injectable()
export class DevWalkthroughService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly drip: DripService,
    private readonly trialLifecycle: TrialLifecycleTriggerService,
    private readonly engagement: EngagementTriggerService,
    private readonly users: UsersService,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'DevWalkthroughService is disabled in production',
      );
    }
  }

  async advanceToDay(userId: string, toDay: number) {
    const createdAt = utcNoonOffset(-toDay);
    const startedAt = utcNoonOffset(-toDay);
    const expiresAt = utcNoonOffset(TRIAL_DAYS - toDay);

    await this.supabase
      .from('user_profiles')
      .update({ created_at: createdAt.toISOString() })
      .eq('id', userId);
    await this.supabase
      .from('user_trials')
      .update({
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId);

    // Clear dedup so the target email can re-fire.
    await this.supabase.from('email_log').delete().eq('user_id', userId);
    await this.supabase.from('email_triggers').delete().eq('user_id', userId);

    return {
      created_at: createdAt.toISOString(),
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }

  async fireJob(job: string, userId: string): Promise<void> {
    if (job === 'welcome')
      return void (await this.engagement.fireWelcome(userId));
    if (job.startsWith('drip'))
      return void (await this.drip.runDripDay(Number(job.slice(4)), userId));
    if (job.startsWith('churn_why_'))
      return void (await this.drip.runChurnWhyCohort(job, userId));
    if (job === 'trial_day_10')
      return void (await this.trialLifecycle.fireTrialDay10(userId));
    if (job === 'trial_day_13')
      return void (await this.trialLifecycle.fireTrialDay13(userId));
    if (job === 'trial_expired')
      return void (await this.trialLifecycle.fireTrialExpired(userId));
    throw new Error(`Unknown job: ${job}`);
  }

  async teardown(userId: string): Promise<void> {
    await this.users.deleteUser(userId);
  }
}
