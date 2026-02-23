/**
 * Market Intelligence Admin Controller
 *
 * Provides admin-only endpoints for monitoring the health and coverage
 * of the market intelligence subsystem (briefings, news, rankings),
 * plus manual triggers for each cron job.
 */

import { Controller, Get, Post, Logger, UseGuards } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { MarketIntelligenceCronService } from './market-intelligence-cron.service';
import { AdminGuard } from '../common/guards/admin-auth.guard';

interface IntelligenceStats {
  total_briefings: number;
  metros_covered: number;
  counties_covered: number;
  oldest_briefing_days: number | null;
  news_articles_last_7d: number;
  rankings_last_refresh: string | null;
  quinn_available: boolean;
}

@UseGuards(AdminGuard)
@Controller('api/admin/intelligence')
export class MarketIntelligenceController {
  private readonly logger = new Logger(MarketIntelligenceController.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly appConfig: AppConfigService,
    private readonly cronService: MarketIntelligenceCronService,
  ) {}

  /**
   * GET /api/admin/intelligence/stats
   *
   * Returns aggregate health metrics for the market intelligence system:
   * briefing coverage, news volume, ranking freshness, and Quinn availability.
   */
  @Get('stats')
  async getStats(): Promise<IntelligenceStats> {
    this.logger.log('GET /api/admin/intelligence/stats');
    const client = this.supabase.getClient();

    // Run independent queries in parallel for performance
    const [
      totalBriefingsResult,
      metrosCoveredResult,
      countiesCoveredResult,
      oldestBriefingResult,
      newsCountResult,
      latestRankingResult,
      quinnAvailable,
    ] = await Promise.all([
      // Total latest briefings
      client
        .from('market_briefings')
        .select('*', { count: 'exact', head: true })
        .eq('is_latest', true),

      // Metro briefing count
      client
        .from('market_briefings')
        .select('*', { count: 'exact', head: true })
        .eq('is_latest', true)
        .eq('geography_type', 'metro'),

      // County briefing count
      client
        .from('market_briefings')
        .select('*', { count: 'exact', head: true })
        .eq('is_latest', true)
        .eq('geography_type', 'county'),

      // Oldest briefing date
      client
        .from('market_briefings')
        .select('generated_date')
        .eq('is_latest', true)
        .order('generated_date', { ascending: true })
        .limit(1)
        .single(),

      // News articles in the last 7 days
      client
        .from('market_news')
        .select('*', { count: 'exact', head: true })
        .gte('published_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),

      // Most recent rankings refresh
      client
        .from('rankings_cache')
        .select('generated_date')
        .eq('is_latest', true)
        .order('generated_date', { ascending: false })
        .limit(1)
        .single(),

      // Quinn (briefing generation) feature flag
      this.appConfig.getBool('BRIEFING_GENERATION_ENABLED', false),
    ]);

    const oldestDays =
      oldestBriefingResult.data?.generated_date
        ? Math.floor(
            (Date.now() -
              new Date(oldestBriefingResult.data.generated_date).getTime()) /
              86_400_000,
          )
        : null;

    return {
      total_briefings: totalBriefingsResult.count ?? 0,
      metros_covered: metrosCoveredResult.count ?? 0,
      counties_covered: countiesCoveredResult.count ?? 0,
      oldest_briefing_days: oldestDays,
      news_articles_last_7d: newsCountResult.count ?? 0,
      rankings_last_refresh: latestRankingResult.data?.generated_date ?? null,
      quinn_available: quinnAvailable,
    };
  }

  // ===========================================================================
  // Manual Cron Triggers
  // ===========================================================================

  /**
   * POST /api/admin/intelligence/trigger/briefings
   * Manually trigger the weekly briefing generation pipeline.
   */
  @Post('trigger/briefings')
  async triggerBriefings(): Promise<{ success: true; message: string }> {
    this.logger.log('Manual trigger: weekly briefings');
    // Fire-and-forget — the cron method handles its own error logging
    this.cronService.handleWeeklyBriefings().catch((err) => {
      this.logger.error(`Manual briefing trigger failed: ${err.message}`);
    });
    return { success: true, message: 'Briefing generation started' };
  }

  /**
   * POST /api/admin/intelligence/trigger/news
   * Manually trigger the daily news ingestion pipeline.
   */
  @Post('trigger/news')
  async triggerNewsIngestion(): Promise<{ success: true; message: string }> {
    this.logger.log('Manual trigger: news ingestion');
    this.cronService.handleDailyNewsIngestion().catch((err) => {
      this.logger.error(`Manual news ingestion trigger failed: ${err.message}`);
    });
    return { success: true, message: 'News ingestion started' };
  }

  /**
   * POST /api/admin/intelligence/trigger/rankings
   * Manually trigger the weekly rankings cache refresh.
   */
  @Post('trigger/rankings')
  async triggerRankings(): Promise<{ success: true; message: string }> {
    this.logger.log('Manual trigger: rankings cache refresh');
    this.cronService.handleWeeklyRankings().catch((err) => {
      this.logger.error(`Manual rankings trigger failed: ${err.message}`);
    });
    return { success: true, message: 'Rankings cache refresh started' };
  }
}
