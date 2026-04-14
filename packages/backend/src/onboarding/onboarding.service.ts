import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ServerEventEmitterService } from '../user-analytics/server-event-emitter.service';

export interface OnboardingMarket {
  geoLevel: string;
  geoId: string;
  name: string;
}

export interface OnboardingState {
  usage_stats: Record<string, number> | null;
  onboarding_checklist: string[] | null;
  dismissed_beacons: string[] | null;
  onboarding_market: OnboardingMarket | null;
  free_report_credits: number | null;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly eventEmitter: ServerEventEmitterService,
  ) {}

  /**
   * Ensure user has an active reverse trial. Returns existing if present,
   * creates one from trial_config otherwise. Handles race via UNIQUE constraint.
   */
  async ensureTrialStarted(userId: string) {
    const { data: existing } = await this.supabase
      .from('user_trials')
      .select('id, tier, expires_at')
      .eq('user_id', userId)
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existing) return existing;

    const { data: config } = await this.supabase
      .from('trial_config')
      .select('is_enabled, duration_days, trial_tier')
      .single();

    if (!config?.is_enabled) {
      this.logger.warn('Trial system disabled in trial_config');
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.duration_days);

    const { data: trial, error } = await this.supabase
      .from('user_trials')
      .insert({
        user_id: userId,
        tier: config.trial_tier,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: raced } = await this.supabase
          .from('user_trials')
          .select('id, tier, expires_at')
          .eq('user_id', userId)
          .is('converted_at', null)
          .is('cancelled_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        return raced;
      }
      this.logger.error(
        `Failed to start trial for ${userId}: ${error.message}`,
      );
      return null;
    }

    this.logger.log(
      `Started ${config.duration_days}d ${config.trial_tier} trial for ${userId}`,
    );

    // Emit only on first-time trial creation (not on existing-trial returns or
    // race-loser returns), so trial.started fires exactly once per trial.
    await this.eventEmitter.emit('trial', 'started', userId, {
      trial_duration_days: config.duration_days,
      trial_tier: config.trial_tier,
    });

    return trial;
  }

  async saveOnboardingMarket(userId: string, market: OnboardingMarket) {
    const { error } = await this.supabase
      .from('user_profiles')
      .update({ onboarding_market: market })
      .eq('id', userId);
    if (error)
      throw new Error(`Failed to save onboarding market: ${error.message}`);
  }

  async updateChecklist(userId: string, completedTaskId: string) {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('onboarding_checklist')
      .eq('id', userId)
      .single();

    const current: string[] = data?.onboarding_checklist ?? [];
    if (current.includes(completedTaskId)) return;

    const { error } = await this.supabase
      .from('user_profiles')
      .update({ onboarding_checklist: [...current, completedTaskId] })
      .eq('id', userId);
    if (error) throw new Error(`Failed to update checklist: ${error.message}`);
  }

  async incrementUsageStat(
    userId: string,
    stat: 'markets_viewed' | 'scores_checked' | 'reports_generated',
  ) {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('usage_stats')
      .eq('id', userId)
      .single();

    const current = data?.usage_stats ?? {
      markets_viewed: 0,
      scores_checked: 0,
      reports_generated: 0,
    };
    current[stat] = (current[stat] || 0) + 1;

    const { error } = await this.supabase
      .from('user_profiles')
      .update({ usage_stats: current })
      .eq('id', userId);
    if (error) throw new Error(`Failed to update usage stat: ${error.message}`);

    // Auto-mark "compare_markets" checklist when user views 2+ markets
    if (stat === 'markets_viewed' && current.markets_viewed >= 2) {
      await this.updateChecklist(userId, 'compare_markets').catch((e) =>
        this.logger.warn(`Auto-mark compare_markets failed: ${e.message}`),
      );
    }
  }

  async dismissBeacon(userId: string, beaconId: string) {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('dismissed_beacons')
      .eq('id', userId)
      .single();

    const current: string[] = data?.dismissed_beacons ?? [];
    if (current.includes(beaconId)) return;

    const { error } = await this.supabase
      .from('user_profiles')
      .update({ dismissed_beacons: [...current, beaconId] })
      .eq('id', userId);
    if (error) throw new Error(`Failed to dismiss beacon: ${error.message}`);
  }

  async getOnboardingState(userId: string): Promise<OnboardingState> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select(
        'usage_stats, onboarding_checklist, dismissed_beacons, onboarding_market, free_report_credits',
      )
      .eq('id', userId)
      .single();

    if (error)
      throw new Error(`Failed to fetch onboarding state: ${error.message}`);

    return {
      usage_stats: data?.usage_stats ?? null,
      onboarding_checklist: data?.onboarding_checklist ?? null,
      dismissed_beacons: data?.dismissed_beacons ?? null,
      onboarding_market: data?.onboarding_market ?? null,
      free_report_credits: data?.free_report_credits ?? null,
    };
  }
}
