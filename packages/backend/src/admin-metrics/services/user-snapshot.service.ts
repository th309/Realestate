/**
 * UserSnapshotService
 *
 * Gathers user counts, trial status, tier distribution, and paywall activity
 * from Supabase. Callers persist the result to admin_user_snapshots.
 *
 * Gracefully degrades when optional tables (user_trials, user_entitlements,
 * paywall_events) are absent — returns 0 for those metrics and logs a warning.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export interface UserSnapshotRow {
  total_users: number;
  new_signups: number;
  active_trials: number;
  expiring_soon: number;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
  paywall_views: number;
  conversions: number;
  mrr_cents: number;
}

@Injectable()
export class UserSnapshotService {
  private readonly logger = new Logger(UserSnapshotService.name);

  async buildUserSnapshotRow(client: SupabaseClient): Promise<UserSnapshotRow> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalUsers, newSignups] = await Promise.all([
      this.countProfiles(client),
      this.countNewSignupsToday(client, todayStart),
    ]);

    const trialCounts = await this.countTrials(client, now);
    const tierCounts = await this.countTiers(client);
    const paywallCounts = await this.countPaywallActivity(client, todayStart);

    return {
      total_users: totalUsers,
      new_signups: newSignups,
      active_trials: trialCounts.active,
      expiring_soon: trialCounts.expiringSoon,
      tier_free: tierCounts.free,
      tier_starter: tierCounts.starter,
      tier_pro: tierCounts.pro,
      tier_enterprise: tierCounts.enterprise,
      paywall_views: paywallCounts.views,
      conversions: paywallCounts.conversions,
      mrr_cents: 0, // Placeholder until Stripe integration
    };
  }

  private async countProfiles(client: SupabaseClient): Promise<number> {
    const { count, error } = await client
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      this.logger.error(
        `[UserSnapshot] Failed to count profiles: ${error.message}`,
      );
      return 0;
    }
    return count ?? 0;
  }

  private async countNewSignupsToday(
    client: SupabaseClient,
    todayStart: Date,
  ): Promise<number> {
    const { count, error } = await client
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if (error) {
      this.logger.warn(
        `[UserSnapshot] Failed to count new signups: ${error.message}`,
      );
      return 0;
    }
    return count ?? 0;
  }

  private async countTrials(
    client: SupabaseClient,
    now: Date,
  ): Promise<{ active: number; expiringSoon: number }> {
    const { data, error } = await client
      .from('user_trials')
      .select('expires_at')
      .eq('status', 'active');

    if (error) {
      this.logger.warn(
        `[UserSnapshot] user_trials query failed (table may not exist): ${error.message}`,
      );
      return { active: 0, expiringSoon: 0 };
    }

    const active = data?.length ?? 0;
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = (data ?? []).filter(
      (t) => t.expires_at && new Date(t.expires_at) <= sevenDaysFromNow,
    ).length;

    return { active, expiringSoon };
  }

  private async countTiers(client: SupabaseClient): Promise<{
    free: number;
    starter: number;
    pro: number;
    enterprise: number;
  }> {
    const { data, error } = await client
      .from('user_entitlements')
      .select('tier_slug');

    if (error) {
      this.logger.warn(
        `[UserSnapshot] user_entitlements query failed (table may not exist): ${error.message}`,
      );
      return { free: 0, starter: 0, pro: 0, enterprise: 0 };
    }

    let free = 0,
      starter = 0,
      pro = 0,
      enterprise = 0;

    for (const row of data ?? []) {
      const slug = (row.tier_slug ?? '').toLowerCase();
      if (slug === 'free') free++;
      else if (slug === 'starter') starter++;
      else if (slug === 'pro') pro++;
      else if (slug === 'enterprise') enterprise++;
    }

    return { free, starter, pro, enterprise };
  }

  private async countPaywallActivity(
    client: SupabaseClient,
    todayStart: Date,
  ): Promise<{ views: number; conversions: number }> {
    const { data, error } = await client
      .from('paywall_events')
      .select('event_type')
      .gte('created_at', todayStart.toISOString());

    if (error) {
      this.logger.warn(
        `[UserSnapshot] paywall_events query failed (table may not exist): ${error.message}`,
      );
      return { views: 0, conversions: 0 };
    }

    let views = 0,
      conversions = 0;

    for (const row of data ?? []) {
      if (row.event_type === 'view') views++;
      else if (row.event_type === 'conversion') conversions++;
    }

    return { views, conversions };
  }
}
