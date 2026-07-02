/**
 * Gemini News Scout Service
 *
 * Uses Gemini 2.0 Flash with Google Search grounding to find news and
 * economic indicators that could impact real estate markets.
 *
 * Based on: data/reports/propertyiq-gemini-news-scout.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { NewsScoutResult, SignalSummary } from './gemini-news.types';
import { scoutNewsForGeography } from './gemini-news-api.helper';
import { getCachedNews, cacheNewsResult } from './gemini-news-cache.helper';
import {
  summarizeSignals,
  formatNewsForPrompt,
} from './gemini-news-format.helper';

// Backward-compatible re-exports (types + category groupings live in .types.ts)
export type {
  NewsCategory,
  LocalNewsItem,
  EconomicIndicator,
  MarketSignal,
  NationalContext,
  ScoutMetadata,
  NewsScoutResult,
  SignalSummary,
} from './gemini-news.types';
export { CATEGORY_GROUPS } from './gemini-news.types';

@Injectable()
export class GeminiNewsService {
  private readonly logger = new Logger(GeminiNewsService.name);
  private readonly geminiApiKey: string | null;
  private readonly geminiModel = 'gemini-2.0-flash';
  private readonly cacheTtlHours = 24;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.geminiApiKey =
      this.configService.get<string>('GOOGLE_AI_API_KEY') || null;
    if (this.geminiApiKey) {
      this.logger.log('Gemini News Service initialized');
    } else {
      this.logger.warn(
        'GOOGLE_AI_API_KEY not configured - news scouting disabled',
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
    if (!this.geminiApiKey) {
      this.logger.warn('Gemini not configured - returning null');
      return null;
    }

    const { forceRefresh = false, ...scoutOptions } = options;

    // Check cache first
    if (!forceRefresh) {
      const cached = await getCachedNews(
        this.supabase,
        geographyId,
        geographyType,
      );
      if (cached) {
        this.logger.log(`Cache hit for ${geographyName}`);
        return cached;
      }
    }

    this.logger.log(`Scouting fresh news for ${geographyName}...`);

    // Scout fresh data
    const result = await this.scoutNewsForGeography(
      geographyId,
      geographyType,
      geographyName,
      state,
      scoutOptions,
    );

    // Cache the result
    if (result) {
      await cacheNewsResult(this.supabase, result, this.cacheTtlHours);
    }

    return result;
  }

  /**
   * Scout news for a specific geography
   */
  async scoutNewsForGeography(
    geographyId: string,
    geographyType: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip',
    geographyName: string,
    state: string,
    options: {
      includeNationalContext?: boolean;
      maxNewsItems?: number;
      lookbackDays?: number;
    } = {},
  ): Promise<NewsScoutResult | null> {
    return scoutNewsForGeography(
      {
        geminiApiKey: this.geminiApiKey,
        geminiModel: this.geminiModel,
        logger: this.logger,
      },
      geographyId,
      geographyType,
      geographyName,
      state,
      options,
    );
  }

  /**
   * Summarize market signals
   */
  summarizeSignals(result: NewsScoutResult): SignalSummary {
    return summarizeSignals(result);
  }

  /**
   * Format news for Claude prompt context
   */
  formatNewsForPrompt(
    result: NewsScoutResult,
    options: {
      maxNewsItems?: number;
      includeIndicators?: boolean;
      includeSignals?: boolean;
      includeNational?: boolean;
    } = {},
  ): string {
    return formatNewsForPrompt(result, options);
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.geminiApiKey;
  }
}
