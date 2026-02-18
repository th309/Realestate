/**
 * Recommendations Service
 *
 * Generates "markets to watch" recommendations based on the user's
 * watchlist and PropertyIQ scores.
 *
 * v1 Algorithm (simplified):
 *   1. Read user's saved markets from analytics_watchlist.
 *   2. Determine the preferred geography level (most frequent in watchlist).
 *   3. Fetch top-scoring markets at that geography level (homeready score).
 *   4. Exclude markets already on the watchlist.
 *   5. Return the top 8 with a reason string.
 *
 * Future: compare score trends (current vs 30 days ago) and recommend
 * markets with the largest positive score improvement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface MarketRecommendation {
  geography_type: string;
  geography_id: string;
  geography_name: string;
  score: number;
  reason: string;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get recommended "markets to watch" for a user.
   *
   * If the user has no watchlist items we fall back to the top-scoring
   * metros overall.
   */
  async getMarketsToWatch(userId: string): Promise<MarketRecommendation[]> {
    const client = this.supabase.getClient();

    // 1. Get user's watchlist
    const { data: watchlist, error: watchlistError } = await client
      .from('analytics_watchlist')
      .select('geography_type, geography_id')
      .eq('user_id', userId);

    if (watchlistError) {
      this.logger.error(`Failed to fetch watchlist: ${watchlistError.message}`);
      throw new Error(watchlistError.message);
    }

    if (!watchlist?.length) {
      // No saved markets -- return top scoring metros overall
      this.logger.log(`User ${userId} has no watchlist; returning top metros`);
      return this.getTopMarkets('metro', [], 8);
    }

    // 2. Determine preferred geo level (most common in watchlist)
    const geoCounts: Record<string, number> = {};
    for (const item of watchlist) {
      geoCounts[item.geography_type] =
        (geoCounts[item.geography_type] || 0) + 1;
    }
    const preferredGeo = Object.entries(geoCounts).sort(
      (a, b) => b[1] - a[1],
    )[0][0];

    // 3. Collect watchlist IDs to exclude at that geo level
    const excludeIds = watchlist
      .filter((w) => w.geography_type === preferredGeo)
      .map((w) => w.geography_id);

    this.logger.log(
      `User ${userId}: preferred geo=${preferredGeo}, excluding ${excludeIds.length} watchlist markets`,
    );

    // 4. Get top scoring markets, excluding watchlist entries
    return this.getTopMarkets(preferredGeo, excludeIds, 8);
  }

  /**
   * Fetch the highest-scoring markets for a given geography level,
   * optionally excluding a set of IDs already on the user's watchlist.
   */
  private async getTopMarkets(
    geoType: string,
    excludeIds: string[],
    limit: number,
  ): Promise<MarketRecommendation[]> {
    const client = this.supabase.getClient();

    // First, find the latest score_date for this geography
    const latestDate = await this.getLatestScoreDate(geoType);
    if (!latestDate) {
      this.logger.warn(`No score_date found for geography=${geoType}`);
      return [];
    }

    // Fetch more rows than needed so we can filter out excludeIds in-memory
    const fetchLimit = limit + excludeIds.length + 10;

    const { data, error } = await client
      .from('propertyiq_scores')
      .select('location_id, location_name, score')
      .eq('geography', geoType)
      .eq('score_type', 'homeready')
      .eq('score_date', latestDate)
      .order('score', { ascending: false })
      .limit(fetchLimit);

    if (error) {
      this.logger.error(`Failed to fetch top markets: ${error.message}`);
      throw new Error(error.message);
    }

    if (!data?.length) return [];

    // Filter out excluded IDs and take top `limit`
    const excludeSet = new Set(excludeIds);
    const filtered = data
      .filter((m) => !excludeSet.has(m.location_id))
      .slice(0, limit);

    const geoLabel = geoType.charAt(0).toUpperCase() + geoType.slice(1);

    return filtered.map((m) => ({
      geography_type: geoType,
      geography_id: m.location_id,
      geography_name: m.location_name || m.location_id,
      score: m.score,
      reason: `High-scoring ${geoLabel.toLowerCase()} in your preferred geography`,
    }));
  }

  /**
   * Get the most recent score_date for a geography level.
   */
  private async getLatestScoreDate(
    geography: string,
  ): Promise<string | null> {
    const client = this.supabase.getClient();

    const { data } = await client
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geography)
      .order('score_date', { ascending: false })
      .limit(1);

    return data?.[0]?.score_date || null;
  }
}
