/**
 * MetricsQueryFallbackService
 *
 * Provides live data when admin snapshot tables are empty.
 * Mirrors the hero-stats-live-fallback pattern: query real source tables
 * and shape the results to match the snapshot table schema.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class MetricsQueryFallbackService {
  private readonly logger = new Logger(MetricsQueryFallbackService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Fallback for admin_score_snapshots: query propertyiq_backtest_outcomes
   * and aggregate into a single synthetic snapshot row.
   */
  async fallbackScoreHistory(): Promise<unknown[]> {
    const client = this.supabase.getClient();

    const { data: outcomes } = await client
      .from('propertyiq_backtest_outcomes')
      .select('score_type, score_value, excess_vs_state_1y')
      .not('score_value', 'is', null)
      .not('excess_vs_state_1y', 'is', null);

    if (!outcomes || outcomes.length === 0) return [];

    // Group by score_type
    const byType = new Map<
      string,
      { validated: number; hits: number; total: number }
    >();
    for (const o of outcomes) {
      const type = o.score_type ?? 'homeready';
      const entry = byType.get(type) ?? { validated: 0, hits: 0, total: 0 };
      entry.total++;
      if (o.score_value >= 70) {
        entry.validated++;
        if (o.excess_vs_state_1y > 0) entry.hits++;
      }
      byType.set(type, entry);
    }

    const now = new Date().toISOString();
    return Array.from(byType.entries()).map(([scoreType, stats]) => ({
      timestamp: now,
      score_type: scoreType,
      correlation_1y: stats.validated > 0 ? stats.hits / stats.validated : 0,
      hit_rate_1y: stats.validated > 0 ? stats.hits / stats.validated : 0,
      scores_validated: stats.validated,
      scores_pending: 0,
      scores_failed: stats.total - stats.validated,
    }));
  }

  /**
   * Fallback for admin_user_snapshots: query user_profiles
   * and build a single synthetic snapshot row.
   */
  async fallbackUserHistory(): Promise<unknown[]> {
    const client = this.supabase.getClient();

    const { count: totalCount } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: newSignups } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // Count by tier
    const tierCounts = { free: 0, starter: 0, pro: 0, enterprise: 0 };
    const { data: tiers } = await client.from('user_profiles').select('tier');

    if (tiers) {
      for (const row of tiers) {
        const t = (row.tier ?? 'free').toLowerCase();
        if (t in tierCounts) tierCounts[t as keyof typeof tierCounts]++;
        else tierCounts.free++;
      }
    }

    // Trial count
    const { count: trialCount } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_trial', true);

    const now = new Date().toISOString();
    return [
      {
        timestamp: now,
        total_users: totalCount ?? 0,
        new_signups: newSignups ?? 0,
        active_trials: trialCount ?? 0,
        expiring_soon: 0,
        tier_free: tierCounts.free,
        tier_starter: tierCounts.starter,
        tier_pro: tierCounts.pro,
        tier_enterprise: tierCounts.enterprise,
        paywall_views: 0,
        conversions: 0,
        mrr_cents: 0,
      },
    ];
  }
}
