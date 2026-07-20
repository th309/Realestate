/**
 * Trial Actions Service
 *
 * Mutations on individual user trials: start, extend, cancel, convert.
 * Split out of TrialService (which keeps config + read/hydration concerns)
 * to stay under CLAUDE.md's 300-line file-size hard limit.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { TrialService, UserTrial } from './trial.service';

@Injectable()
export class TrialActionsService {
  private readonly logger = new Logger(TrialActionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly trialService: TrialService,
  ) {}

  /**
   * Start a trial for a user
   */
  async startTrial(userId: string, tier?: string): Promise<UserTrial> {
    const client = this.supabase.getClient();

    // Get config for default values
    const config = await this.trialService.getConfig();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.duration_days);

    const { data, error } = await client
      .from('user_trials')
      .insert({
        user_id: userId,
        tier: tier || config.trial_tier,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to start trial: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Started trial for user ${userId}`);
    return data;
  }

  /**
   * Extend a user's trial
   */
  async extendTrial(
    userId: string,
    additionalDays: number,
  ): Promise<UserTrial> {
    const client = this.supabase.getClient();

    const { data: existing, error: fetchError } = await client
      .from('user_trials')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw new Error('Trial not found');
    }

    const currentExpiry = new Date(existing.expires_at);
    currentExpiry.setDate(currentExpiry.getDate() + additionalDays);

    const { data, error } = await client
      .from('user_trials')
      .update({ expires_at: currentExpiry.toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(
      `Extended trial for user ${userId} by ${additionalDays} days`,
    );
    return data;
  }

  /**
   * Cancel a user's trial
   */
  async cancelTrial(userId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('user_trials')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Cancelled trial for user ${userId}`);
  }

  /**
   * Convert a trial (user subscribed)
   */
  async convertTrial(userId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('user_trials')
      .update({ converted_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Converted trial for user ${userId}`);
  }
}
