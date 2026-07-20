/**
 * Trial Service
 *
 * Manages trial configuration and user trials.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getPaywallCountsForUsers } from '../users/users-batch-fetch.helper';
import { getSessionCountsForUsers } from '../../common/user-sessions-count.util';
import {
  hydrateTrialRecords,
  computeTrialStats,
  type TrialStatsResult,
} from './trial-hydration.util';

export interface TrialConfig {
  id: string;
  is_enabled: boolean;
  duration_days: number;
  trial_tier: string;
  show_banner: boolean;
  updated_at: string;
}

export interface UserTrial {
  id: string;
  user_id: string;
  tier: string;
  started_at: string;
  expires_at: string;
  converted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  // Joined/computed fields — populated by hydrateTrialRecords()
  user_email?: string;
  user_name?: string;
  days_remaining?: number;
  paywall_hits?: number;
  reason_code?: string | null;
  reason_label?: string | null;
  detail?: string | null;
}

@Injectable()
export class TrialService {
  private readonly logger = new Logger(TrialService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get trial configuration
   */
  async getConfig(): Promise<TrialConfig> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('trial_config')
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to get trial config: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Update trial configuration
   */
  async updateConfig(
    updates: Partial<{
      is_enabled: boolean;
      duration_days: number;
      trial_tier: string;
      show_banner: boolean;
    }>,
  ): Promise<TrialConfig> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('trial_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update trial config: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log('Updated trial configuration');
    return data;
  }

  /**
   * Get all active trials
   */
  async getActiveTrials(): Promise<UserTrial[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('user_trials')
      .select('*')
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get active trials: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get all trials (including expired/converted)
   */
  async getAllTrials(options?: {
    limit?: number;
    offset?: number;
    status?: 'active' | 'expired' | 'converted' | 'cancelled';
  }): Promise<{ trials: UserTrial[]; total: number }> {
    const client = this.supabase.getClient();

    let query = client.from('user_trials').select('*', { count: 'exact' });

    // Filter by status
    if (options?.status === 'active') {
      query = query
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', new Date().toISOString());
    } else if (options?.status === 'expired') {
      query = query
        .is('converted_at', null)
        .is('cancelled_at', null)
        .lt('expires_at', new Date().toISOString());
    } else if (options?.status === 'converted') {
      query = query.not('converted_at', 'is', null);
    } else if (options?.status === 'cancelled') {
      query = query.not('cancelled_at', 'is', null);
    }

    // Pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 20) - 1,
      );
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to get trials: ${error.message}`);
      throw new Error(error.message);
    }

    const trials = await this.hydrate(data || []);
    return { trials, total: count || 0 };
  }

  /** Joins profile identity, real paywall-hit counts, and the latest churn
   * reason onto raw user_trials rows. */
  private async hydrate(trials: UserTrial[]): Promise<UserTrial[]> {
    if (!trials.length) return [];

    const client = this.supabase.getClient();
    const userIds = trials.map((t) => t.user_id);

    const [profilesResult, paywallCounts, churnResult] = await Promise.all([
      client
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds),
      getPaywallCountsForUsers(client, userIds),
      client
        .from('churn_survey_responses')
        .select('user_id, reason_code, detail, created_at')
        .in('user_id', userIds),
    ]);

    return hydrateTrialRecords(
      trials,
      profilesResult.data || [],
      paywallCounts,
      churnResult.data || [],
      Date.now(),
    );
  }

  /**
   * Get trial stats
   */
  async getStats(): Promise<TrialStatsResult> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();
    const soonCutoff = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      activeResult,
      expiredResult,
      convertedResult,
      cancelledResult,
      expiringSoonResult,
      activeUsersResult,
    ] = await Promise.all([
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', now),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .lt('expires_at', now),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .not('converted_at', 'is', null),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .not('cancelled_at', 'is', null),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', now)
        .lte('expires_at', soonCutoff),
      client
        .from('user_trials')
        .select('user_id')
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', now),
    ]);

    const activeUserIds = (activeUsersResult.data || []).map((t) => t.user_id);
    const sessionCounts = await getSessionCountsForUsers(client, activeUserIds);
    const activeUserSessionCounts = activeUserIds.map(
      (id) => sessionCounts.get(id) ?? 0,
    );

    return computeTrialStats(
      {
        active: activeResult.count || 0,
        expired: expiredResult.count || 0,
        converted: convertedResult.count || 0,
        cancelled: cancelledResult.count || 0,
        expiringSoon: expiringSoonResult.count || 0,
      },
      activeUserSessionCounts,
    );
  }

  /**
   * Start a trial for a user
   */
  async startTrial(userId: string, tier?: string): Promise<UserTrial> {
    const client = this.supabase.getClient();

    // Get config for default values
    const config = await this.getConfig();

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
