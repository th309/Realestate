/**
 * News Scout Service
 *
 * Uses AiProviderService (provider-agnostic) to find news and
 * economic indicators that could impact real estate markets.
 * The AI model is configured via the `news_scout` purpose in
 * the `ai_model_config` table — any supported provider works.
 *
 * Split into modules:
 * - news-scout.types.ts        — All type definitions and constants
 * - news-scout-prompts.ts      — Prompt templates
 * - news-scout-parser.ts       — JSON response parsing utilities
 * - news-scout-functions.ts    — Standalone scouting functions
 * - news-scout.service.ts      — NestJS service (this file)
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';

import type { NewsScoutResult, SignalSummary } from './news-scout.types';
import { scoutNewsForGeography } from './news-scout-functions';
import {
  summarizeSignals as summarizeSignalsFn,
  formatNewsForPrompt as formatNewsForPromptFn,
} from './news-scout-formatting';

// Re-export all types and constants so existing consumers keep working
export type {
  NewsCategory,
  LocalNewsItem,
  EconomicIndicator,
  MarketSignal,
  NationalContext,
  ScoutMetadata,
  NewsScoutResult,
  SignalSummary,
} from './news-scout.types';
export { CATEGORY_GROUPS } from './news-scout.types';

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

@Injectable()
export class NewsScoutService {
  private readonly logger = new Logger(NewsScoutService.name);
  private readonly cacheTtlHours = 24;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiProvider: AiProviderService,
  ) {
    this.logger.log('News Scout Service initialized (provider-agnostic)');
  }

  /**
   * Get news for geography (from cache or fresh scout)
   */
  async getOrScoutNews(
    geographyId: string,
    geographyType: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip',
    geographyName: string,
    state: string,
    options: {
      forceRefresh?: boolean;
      includeNationalContext?: boolean;
      maxNewsItems?: number;
      lookbackDays?: number;
    } = {},
  ): Promise<NewsScoutResult | null> {
    const { forceRefresh = false, ...scoutOptions } = options;

    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = await this.getCachedNews(geographyId, geographyType);
        if (cached) {
          this.logger.log(`Cache hit for ${geographyName}`);
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn(
          `Cache lookup failed for ${geographyName} (table may not exist): ${cacheError?.message || cacheError}`,
        );
      }
    }

    this.logger.log(`Scouting fresh news for ${geographyName}...`);

    // Delegate to extracted scouting function
    const result = await scoutNewsForGeography(
      this.aiProvider,
      this.logger,
      geographyId,
      geographyType,
      geographyName,
      state,
      scoutOptions,
    );

    // Cache the result only if it has actual data
    if (
      result &&
      (result.local_news.length > 0 || result.economic_indicators.length > 0)
    ) {
      try {
        await this.cacheNewsResult(result);
      } catch (cacheError) {
        this.logger.warn(
          `Failed to cache news result for ${geographyName}: ${cacheError?.message || cacheError}`,
        );
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // CACHING
  // ---------------------------------------------------------------------------

  private async getCachedNews(
    geographyId: string,
    geographyType: string,
  ): Promise<NewsScoutResult | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('report_news_cache')
      .select('news_data')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        this.logger.warn(`Cache query error (${error.code}): ${error.message}`);
      }
      return null;
    }

    return data?.news_data as NewsScoutResult | null;
  }

  private async cacheNewsResult(result: NewsScoutResult): Promise<void> {
    const client = this.supabase.getClient();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.cacheTtlHours);

    const { error } = await client.from('report_news_cache').upsert(
      {
        geography_id: result.geography_id,
        geography_type: result.geography_type,
        geography_name: result.geography_name,
        news_data: result,
        fetched_at: result.scout_metadata.search_timestamp,
        expires_at: expiresAt.toISOString(),
        model_used: result.scout_metadata.model_used,
        local_news_count: result.local_news.length,
        indicators_count: result.economic_indicators.length,
        signals_count: result.market_signals.length,
      },
      { onConflict: 'geography_id,geography_type' },
    );

    if (error) {
      this.logger.warn(
        `Failed to cache news (${error.code}): ${error.message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITY FUNCTIONS (delegated to news-scout-formatting.ts)
  // ---------------------------------------------------------------------------

  /** Summarize market signals */
  summarizeSignals(result: NewsScoutResult): SignalSummary {
    return summarizeSignalsFn(result);
  }

  /** Format news for prompt context */
  formatNewsForPrompt(
    result: NewsScoutResult,
    options: {
      maxNewsItems?: number;
      includeIndicators?: boolean;
      includeSignals?: boolean;
      includeNational?: boolean;
    } = {},
  ): string {
    return formatNewsForPromptFn(result, options);
  }

  /**
   * Check if service is available.
   * AiProviderService handles config resolution — if news_scout purpose
   * is configured in ai_model_config, the service is available.
   */
  isAvailable(): boolean {
    return true;
  }
}
