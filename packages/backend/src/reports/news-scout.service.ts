/**
 * Claude News Scout Service
 *
 * Uses Claude (Anthropic) with web search tool to find news and
 * economic indicators that could impact real estate markets.
 *
 * Split into modules:
 * - claude-news.types.ts      — All type definitions and constants
 * - claude-news-prompts.ts    — Prompt templates
 * - claude-news-parser.ts     — JSON response parsing utilities
 * - claude-news-scout.ts      — Standalone scouting functions
 * - claude-news.service.ts    — NestJS service (this file)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import Anthropic from '@anthropic-ai/sdk';

import type { NewsScoutResult, SignalSummary } from './claude-news.types';
import { scoutNewsForGeography } from './claude-news-scout';
import {
  summarizeSignals as summarizeSignalsFn,
  formatNewsForPrompt as formatNewsForPromptFn,
} from './claude-news-formatting';

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
} from './claude-news.types';
export { CATEGORY_GROUPS } from './claude-news.types';

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

@Injectable()
export class ClaudeNewsService {
  private readonly logger = new Logger(ClaudeNewsService.name);
  private readonly anthropicClient: Anthropic | null = null;
  private readonly anthropicApiKey: string | null;
  private readonly claudeModel = 'claude-haiku-4-5-20251001';
  private readonly cacheTtlHours = 24;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.anthropicApiKey =
      this.configService.get<string>('ANTHROPIC_API_KEY') || null;
    if (this.anthropicApiKey) {
      this.anthropicClient = new Anthropic({ apiKey: this.anthropicApiKey });
      this.logger.log('Claude News Service initialized');
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured - news scouting disabled',
      );
    }
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
    if (!this.anthropicClient) {
      this.logger.warn('Anthropic not configured - returning null');
      return null;
    }

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
      this.anthropicClient,
      this.claudeModel,
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
  // UTILITY FUNCTIONS (delegated to claude-news-formatting.ts)
  // ---------------------------------------------------------------------------

  /** Summarize market signals */
  summarizeSignals(result: NewsScoutResult): SignalSummary {
    return summarizeSignalsFn(result);
  }

  /** Format news for Claude prompt context */
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
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.anthropicApiKey;
  }
}
