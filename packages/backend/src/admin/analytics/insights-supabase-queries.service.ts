/**
 * Insights Supabase Queries Service
 *
 * Pure data-access layer for the AI Insights engine. Each method
 * issues Supabase queries for a single domain (revenue, trials,
 * feature usage, tier matrix, user aggregates) and returns a
 * typed snapshot. No orchestration logic lives here.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  RevenueSnapshot,
  TrialSnapshot,
  FeatureUsageSnapshot,
  UserAggregates,
} from './ai-insights.types';

@Injectable()
export class InsightsSupabaseQueriesService {
  constructor(private readonly supabase: SupabaseService) {}

  async fetchRevenueSnapshot(since: string): Promise<RevenueSnapshot> {
    const client = this.supabase.getClient();

    const [paidResult, tierResult, failedResult, churnResult, tierPriceResult] =
      await Promise.all([
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .in('subscription_tier', ['pro', 'enterprise'])
          .eq('subscription_status', 'active'),
        client
          .from('user_profiles')
          .select('subscription_tier')
          .in('subscription_tier', ['pro', 'enterprise'])
          .eq('subscription_status', 'active'),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_status', 'past_due'),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_status', 'cancelled')
          .gte('updated_at', since),
        client
          .from('subscription_tiers')
          .select('slug, price_monthly')
          .in('slug', ['pro', 'enterprise']),
      ]);

    const tierCounts: Record<string, number> = {};
    (tierResult.data || []).forEach((u: { subscription_tier: string }) => {
      const tier = u.subscription_tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    const tierPrices: Record<string, number> = {};
    (tierPriceResult.data || []).forEach(
      (t: { slug: string; price_monthly: string | number | null }) => {
        tierPrices[t.slug] = Number(t.price_monthly) || 0;
      },
    );
    const estimatedMrr =
      (tierCounts['pro'] || 0) * (tierPrices['pro'] || 0) +
      (tierCounts['enterprise'] || 0) * (tierPrices['enterprise'] || 0);

    return {
      totalPaidUsers: paidResult.count || 0,
      usersByTier: tierCounts,
      activeSubscriptions: paidResult.count || 0,
      failedPayments: failedResult.count || 0,
      recentChurns: churnResult.count || 0,
      estimatedMrr,
    };
  }

  async fetchTrialSnapshot(since: string): Promise<TrialSnapshot> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    // `since` param kept for API consistency — trial queries use current time
    void since;

    const [
      activeResult,
      expiredResult,
      convertedResult,
      cancelledResult,
      trialDurations,
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
        .lte('expires_at', now),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .not('converted_at', 'is', null),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .not('cancelled_at', 'is', null),
      client.from('user_trials').select('started_at, expires_at'),
    ]);

    const active = activeResult.count || 0;
    const expired = expiredResult.count || 0;
    const converted = convertedResult.count || 0;
    const cancelled = cancelledResult.count || 0;
    const totalCompleted = expired + converted + cancelled;
    const conversionRate =
      totalCompleted > 0 ? (converted / totalCompleted) * 100 : 0;

    let avgTrialDurationDays = 14;
    const trials = trialDurations.data || [];
    if (trials.length > 0) {
      const totalDays = trials.reduce(
        (sum: number, t: { started_at: string; expires_at: string }) => {
          const start = new Date(t.started_at).getTime();
          const end = new Date(t.expires_at).getTime();
          return sum + (end - start) / (1000 * 60 * 60 * 24);
        },
        0,
      );
      avgTrialDurationDays = Math.round(totalDays / trials.length);
    }

    return {
      activeTrials: active,
      expiredTrials: expired,
      convertedTrials: converted,
      cancelledTrials: cancelled,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgTrialDurationDays,
    };
  }

  async fetchFeatureUsageSnapshot(
    since: string,
  ): Promise<FeatureUsageSnapshot> {
    const client = this.supabase.getClient();

    const { data: topEvents } = await client
      .from('analytics_events')
      .select('event_name, user_id')
      .gte('created_at', since);

    const eventCounts: Record<string, { count: number; users: Set<string> }> =
      {};
    (topEvents || []).forEach((e: { event_name: string; user_id?: string }) => {
      const name = e.event_name;
      if (!eventCounts[name]) {
        eventCounts[name] = { count: 0, users: new Set() };
      }
      eventCounts[name].count++;
      if (e.user_id) eventCounts[name].users.add(e.user_id);
    });

    const topEventsByCount = Object.entries(eventCounts)
      .map(([eventName, { count, users }]) => ({
        eventName,
        count,
        uniqueUsers: users.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const { data: tierEvents } = await client
      .from('analytics_events')
      .select('user_tier')
      .gte('created_at', since);

    const eventsByTier: Record<string, number> = {};
    (tierEvents || []).forEach((e: { user_tier: string }) => {
      const tier = e.user_tier || 'unknown';
      eventsByTier[tier] = (eventsByTier[tier] || 0) + 1;
    });

    return { topEventsByCount, eventsByTier, recentTrend: [] };
  }

  async fetchTierMatrix(): Promise<Record<string, unknown>> {
    const client = this.supabase.getClient();

    const [{ data: features }, { data: tiers }, { data: tierFeatures }] =
      await Promise.all([
        client
          .from('feature_definitions')
          .select('id, slug, name, category, value_type')
          .eq('is_active', true),
        client
          .from('subscription_tiers')
          .select('id, slug, name')
          .eq('is_active', true)
          .order('display_order'),
        client.from('tier_features').select('tier_id, feature_id, value'),
      ]);

    return { features, tiers, tierFeatures };
  }

  async fetchUserAggregates(since: string): Promise<UserAggregates> {
    const client = this.supabase.getClient();

    const [totalResult, tierResult, recentResult, activeResult, paidResult] =
      await Promise.all([
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true }),
        client.from('user_profiles').select('subscription_tier'),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_login_at', since),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .in('subscription_tier', ['pro', 'enterprise'])
          .eq('subscription_status', 'active'),
      ]);

    const usersByTier: Record<string, number> = {};
    (tierResult.data || []).forEach((u: { subscription_tier: string }) => {
      const tier = u.subscription_tier || 'free';
      usersByTier[tier] = (usersByTier[tier] || 0) + 1;
    });

    return {
      totalUsers: totalResult.count || 0,
      usersByTier,
      recentSignups30d: recentResult.count || 0,
      activeUsers30d: activeResult.count || 0,
      paidUsers: paidResult.count || 0,
    };
  }
}
