/**
 * Monthly Digest Data Service
 *
 * Handles all data fetching for the monthly digest email:
 * - User eligibility and dedup queries
 * - Region name lookups via geographies table
 * - PIQ score lookups (current + previous month)
 * - Watchlist mover computation (biggest score changes)
 * - "Market to watch" selection (highest-improving non-top-5 market)
 *
 * Used by MonthlyDigestService for orchestration.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import {
  EligibleUser,
  WatchlistMover,
  MarketToWatch,
} from './monthly-digest.types';

@Injectable()
export class MonthlyDigestDataService {
  private readonly logger = new Logger(MonthlyDigestDataService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ==========================================================================
  // User Eligibility & Dedup
  // ==========================================================================

  async getEligibleUsers(): Promise<EligibleUser[]> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('user_id')
      .not('quiz_completed_at', 'is', null);

    if (error || !data?.length) {
      if (error) {
        this.logger.error(`Failed to query eligible users: ${error.message}`);
      }
      return [];
    }

    const userIds = data.map((row) => row.user_id);
    const { data: profiles } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds);

    return (profiles as EligibleUser[]) || [];
  }

  async getAlreadySentThisMonth(userIds: string[]): Promise<Set<string>> {
    const sentIds = new Set<string>();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data } = await this.supabase
      .from('email_log')
      .select('user_id')
      .in('user_id', userIds)
      .eq('email_type', 'monthly_digest')
      .gte('created_at', monthStart.toISOString());

    if (data) {
      for (const row of data) sentIds.add(row.user_id);
    }
    return sentIds;
  }

  async getMarketingOptOutIds(userIds: string[]): Promise<Set<string>> {
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

  // ==========================================================================
  // Region & Score Lookups
  // ==========================================================================

  async lookupRegionNames(
    regionIds: string[],
    geoType: string,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (!regionIds.length) return names;

    const { data } = await this.supabase
      .from('geographies')
      .select('geography_id, name')
      .eq('geography_type', geoType)
      .in('geography_id', regionIds);

    if (data) {
      for (const row of data) {
        names.set(row.geography_id, row.name);
      }
    }
    return names;
  }

  async lookupLatestPiqScores(
    regionIds: string[],
    geography: string,
  ): Promise<Map<string, number>> {
    return this.lookupPiqScoresAtOffset(regionIds, geography, 0);
  }

  async lookupPreviousPiqScores(
    regionIds: string[],
    geography: string,
  ): Promise<Map<string, number>> {
    return this.lookupPiqScoresAtOffset(regionIds, geography, 1);
  }

  /**
   * Fetch PIQ homeready scores for the given regions.
   * offset=0 is the latest score date, offset=1 is the previous month.
   */
  private async lookupPiqScoresAtOffset(
    regionIds: string[],
    geography: string,
    monthOffset: number,
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    if (!regionIds.length) return scores;

    const { data: dates } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geography)
      .eq('score_type', 'homeready')
      .order('score_date', { ascending: false })
      .limit(50);

    if (!dates?.length) return scores;

    const uniqueDates = [...new Set(dates.map((d) => d.score_date))];
    const targetDate =
      uniqueDates[Math.min(monthOffset, uniqueDates.length - 1)];
    if (!targetDate) return scores;

    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('location_id, score')
      .eq('geography', geography)
      .eq('score_type', 'homeready')
      .eq('score_date', targetDate)
      .in('location_id', regionIds);

    if (data) {
      for (const row of data) {
        if (row.score != null) {
          scores.set(row.location_id, Number(row.score));
        }
      }
    }
    return scores;
  }

  // ==========================================================================
  // Watchlist & Market-to-Watch
  // ==========================================================================

  async buildWatchlistMovers(userId: string): Promise<WatchlistMover[]> {
    const { data: watchlist } = await this.supabase
      .from('analytics_watchlist')
      .select('geography_type, geography_id, geography_name')
      .eq('user_id', userId)
      .limit(20);

    if (!watchlist?.length) return [];

    const metroItems = watchlist.filter(
      (w) => w.geography_type === 'metro' || w.geography_type === 'Metro',
    );
    if (!metroItems.length) return [];

    const regionIds = metroItems.map((w) => w.geography_id);
    const currentScores = await this.lookupLatestPiqScores(regionIds, 'metro');
    const previousScores = await this.lookupPreviousPiqScores(
      regionIds,
      'metro',
    );

    const movers: WatchlistMover[] = [];
    for (const item of metroItems) {
      const current = currentScores.get(item.geography_id);
      const previous = previousScores.get(item.geography_id);
      if (current == null || previous == null) continue;

      const diff = Math.round(current - previous);
      if (diff === 0) continue;

      movers.push({
        name: item.geography_name || item.geography_id,
        oldScore: Math.round(previous),
        newScore: Math.round(current),
        direction: diff > 0 ? 'up' : 'down',
      });
    }

    movers.sort(
      (a, b) =>
        Math.abs(b.newScore - b.oldScore) - Math.abs(a.newScore - a.oldScore),
    );
    return movers.slice(0, 5);
  }

  async pickMarketToWatch(
    excludeRegionIds: string[],
  ): Promise<MarketToWatch | null> {
    const currentScores = new Map<string, number>();
    const previousScores = new Map<string, number>();

    const { data: latestDates } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', 'metro')
      .eq('score_type', 'homeready')
      .order('score_date', { ascending: false })
      .limit(50);

    if (!latestDates?.length) return null;

    const uniqueDates = [...new Set(latestDates.map((d) => d.score_date))];
    if (uniqueDates.length < 2) return null;

    const [latestDate, previousDate] = uniqueDates;

    const [{ data: latest }, { data: previous }] = await Promise.all([
      this.supabase
        .from('propertyiq_scores')
        .select('location_id, score')
        .eq('geography', 'metro')
        .eq('score_type', 'homeready')
        .eq('score_date', latestDate),
      this.supabase
        .from('propertyiq_scores')
        .select('location_id, score')
        .eq('geography', 'metro')
        .eq('score_type', 'homeready')
        .eq('score_date', previousDate),
    ]);

    if (latest) {
      for (const r of latest) {
        if (r.score != null) currentScores.set(r.location_id, Number(r.score));
      }
    }
    if (previous) {
      for (const r of previous) {
        if (r.score != null) previousScores.set(r.location_id, Number(r.score));
      }
    }

    const excludeSet = new Set(excludeRegionIds);
    let bestId: string | null = null;
    let bestChange = 0;

    for (const [regionId, currentScore] of currentScores) {
      if (excludeSet.has(regionId)) continue;
      const prev = previousScores.get(regionId);
      if (prev == null) continue;

      const change = currentScore - prev;
      if (change > bestChange) {
        bestChange = change;
        bestId = regionId;
      }
    }

    if (!bestId || bestChange <= 0) return null;

    const names = await this.lookupRegionNames([bestId], 'metro');
    const name = names.get(bestId) || bestId;
    const score = Math.round(currentScores.get(bestId) || 0);
    const change = Math.round(bestChange);

    return {
      name,
      reason: `PIQ score jumped ${change} points this month to ${score}, signaling improving market conditions. Worth adding to your watchlist.`,
    };
  }
}
