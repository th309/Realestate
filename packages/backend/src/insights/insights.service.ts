/**
 * Insights Service
 *
 * Generates, caches, and serves AI-powered market insights. AI generation goes
 * through the centralized AiProviderService, so the model is selectable per
 * purpose via the `ai_model_config` table (default DeepSeek) — never a hardcoded
 * model or a raw env-var fallback. Assembles context from ScoringService and
 * MetricResolutionService, then feeds prompt templates to the provider.
 *
 * Heavy lifting is delegated to:
 * - insight-context-builder.ts  — assembles InsightContext from scores/metrics
 * - insight-batch-generator.ts  — batch generation with concurrency control
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { NewsScoutService } from '../reports/news-scout.service';
import {
  AI_PURPOSES,
  AiCompletionResponse,
} from '../ai-provider/ai-provider.types';
import {
  MarketInsight,
  InsightContext,
  InsightType,
  GeoLevel,
} from './insights.types';
import { buildInsightContext } from './insight-context-builder';
import { buildFallbackInsightContent } from './insights-fallback';
import { generateBatchInsights, CACHE_TTL_MS } from './insight-batch-generator';
import {
  buildMarketTakePrompt,
  buildScoreExplanationPrompt,
  buildTrendInterpretationPrompt,
  buildMarketOverviewPrompt,
  buildMarketOutlookPrompt,
} from './insight-prompts';

/** Maps insight type to its prompt builder function */
const PROMPT_BUILDERS: Record<InsightType, (ctx: InsightContext) => string> = {
  market_take: buildMarketTakePrompt,
  score_explanation: buildScoreExplanationPrompt,
  trend_interpretation: buildTrendInterpretationPrompt,
  market_overview: buildMarketOverviewPrompt,
  archetype_match: buildMarketOverviewPrompt,
  // No-news fallback; the news-aware variant is built in generateSingleInsight.
  market_outlook: (ctx) => buildMarketOutlookPrompt(ctx),
};

/**
 * Maps insight type to its configurable AI purpose (an `ai_model_config` row).
 * archetype_match reuses the market_overview purpose (same prompt builder).
 */
const INSIGHT_PURPOSES: Record<InsightType, string> = {
  market_take: AI_PURPOSES.MARKET_TAKE,
  score_explanation: AI_PURPOSES.SCORE_EXPLANATION,
  trend_interpretation: AI_PURPOSES.TREND_INTERPRETATION,
  market_overview: AI_PURPOSES.MARKET_OVERVIEW,
  archetype_match: AI_PURPOSES.MARKET_OVERVIEW,
  market_outlook: AI_PURPOSES.MARKET_OUTLOOK,
};

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
    private readonly geoChain: GeographyChainService,
    private readonly aiProvider: AiProviderService,
    private readonly newsScout: NewsScoutService,
  ) {}

  /**
   * Retrieve a cached insight or generate a fresh one for the given region.
   */
  async getInsight(
    regionId: string,
    geoLevel: string,
    insightType: string,
    archetypeId?: string,
  ): Promise<MarketInsight | null> {
    // Check cache first.
    const cached = await this.getCachedInsight(
      regionId,
      geoLevel,
      insightType,
      archetypeId,
    );
    if (cached) return cached;

    // Build context (needed for live generation AND the deterministic fallback).
    const context = await this.buildInsightContext(regionId, geoLevel);

    const componentValue = (o?: { value: number | null }): number | null =>
      o && typeof o.value === 'number' ? o.value : null;
    const makeFallback = (): MarketInsight => ({
      id: '',
      region_id: regionId,
      geo_level: geoLevel as GeoLevel,
      insight_type: insightType as InsightType,
      content: buildFallbackInsightContent(
        {
          region_name: context.region_name,
          score: context.scores?.propertyiq ?? null,
          grade: null,
          median_price: componentValue(context.key_metrics?.['home_value']),
          days_on_market: componentValue(
            context.score_components?.['median_days_on_market'],
          ),
          price_reduced_share: componentValue(
            context.score_components?.['price_reduced_share'],
          ),
          zhvi_yoy: componentValue(context.score_components?.['zhvi_yoy']),
        },
        insightType,
      ),
      model: 'fallback-template',
      archetype_id: archetypeId || '__none__',
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });

    // Generate a fresh insight via the centralized AI provider (model selectable
    // per purpose in ai_model_config; default DeepSeek).
    const result = await this.generateSingleInsight(
      context,
      insightType as InsightType,
    );

    // Generation failed/empty — serve the deterministic fallback (HTTP 200)
    // instead of throwing. Do not cache the fallback; a later request regenerates.
    if (!result || !result.content) return makeFallback();

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    const row = {
      region_id: regionId,
      geo_level: geoLevel,
      insight_type: insightType,
      archetype_id: archetypeId || '__none__',
      content: result.content,
      model: result.model,
      generated_at: now,
      expires_at: expiresAt,
    };

    const { data: upserted, error: upsertError } = await this.supabase
      .from('market_insights')
      .upsert(row, {
        onConflict: 'region_id,geo_level,insight_type,archetype_id',
      })
      .select()
      .single();

    if (upsertError) {
      this.logger.error(
        `Failed to persist insight for ${regionId}/${geoLevel}/${insightType}: ${upsertError.message}`,
      );
    }

    return (upserted as MarketInsight) ?? ({ ...row, id: '' } as MarketInsight);
  }

  /** Cache-only lookup: stored non-expired insight or null. Never generates. */
  async getCachedInsight(
    regionId: string,
    geoLevel: string,
    insightType: string,
    archetypeId?: string,
  ): Promise<MarketInsight | null> {
    const { data } = await this.supabase
      .from('market_insights')
      .select('*')
      .eq('region_id', regionId)
      .eq('geo_level', geoLevel)
      .eq('insight_type', insightType)
      .gt('expires_at', new Date().toISOString())
      .eq('archetype_id', archetypeId || '__none__')
      .limit(1)
      .maybeSingle(); // not single(): a cache miss (0 rows) is expected — single() 406s on it
    return (data as MarketInsight) ?? null;
  }

  /**
   * Generate insights for all regions at a given geography level.
   * Intended for batch/cron usage. Delegates to insight-batch-generator.
   */
  async generateBatchInsights(
    geoLevel: string,
  ): Promise<{ generated: number; failed: number; duration_ms: number }> {
    return generateBatchInsights(
      geoLevel,
      this.supabase,
      (regionId, geo) => this.buildInsightContext(regionId, geo),
      (context, type) => this.generateSingleInsight(context, type),
    );
  }

  /**
   * Assemble the InsightContext for a single region.
   * Delegates to insight-context-builder.
   */
  async buildInsightContext(
    regionId: string,
    geoLevel: string,
  ): Promise<InsightContext> {
    return buildInsightContext(
      regionId,
      geoLevel,
      this.scoringService,
      this.metricResolution,
      this.geoChain,
    );
  }

  /**
   * Build the prompt for the insight type and run it through the centralized
   * AI provider. Returns the full provider response (content + actual model)
   * or null if generation failed or produced no text.
   */
  async generateSingleInsight(
    context: InsightContext,
    insightType: InsightType,
  ): Promise<AiCompletionResponse | null> {
    // market_outlook weaves in live local news (Gemini news scout) — fetched
    // here because it is async while the prompt builders are sync.
    const prompt =
      insightType === 'market_outlook'
        ? buildMarketOutlookPrompt(
            context,
            await this.buildNewsContext(context),
          )
        : PROMPT_BUILDERS[insightType](context);
    // deepseek-v4 models reason before answering, so a tight budget gets consumed
    // by the hidden reasoning and the answer truncates to empty. Be generous — the
    // PROMPT keeps the visible output short (~50 words for the quick insights); this
    // is just headroom so the model actually reaches the answer.
    // deepseek-v4 reasons before answering; a tight budget gets eaten by the
    // hidden reasoning and truncates the answer mid-sentence. market_outlook's
    // ~80-word answer needs the same generous headroom as market_overview.
    const maxTokens =
      insightType === 'market_overview' || insightType === 'market_outlook'
        ? 4000
        : 1500;
    const purpose = INSIGHT_PURPOSES[insightType] ?? AI_PURPOSES.MARKET_TAKE;

    try {
      const response = await this.aiProvider.complete(purpose, {
        userPrompt: prompt,
        maxTokens,
      });
      return response.content ? response : null;
    } catch (err) {
      this.logger.error(
        `Insight generation failed for ${context.region_id}/${insightType} (purpose=${purpose}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Fetch + format recent local real-estate/economic news for the prompt via the
   * Gemini-backed news scout. 90-day lookback to match the Score's 3-month
   * momentum window. The scout caches results 24h in report_news_cache.
   */
  private async buildNewsContext(context: InsightContext): Promise<string> {
    try {
      const [name, state] = context.region_name.split(',').map((s) => s.trim());
      const result = await this.newsScout.getOrScoutNews(
        context.region_id,
        context.geo_level,
        name || context.region_name,
        state || '',
        { maxNewsItems: 6, lookbackDays: 90, includeNationalContext: false },
      );
      if (!result) return '';
      return this.newsScout.formatNewsForPrompt(result, {
        maxNewsItems: 6,
        includeIndicators: true,
        includeSignals: true,
        includeNational: false,
      });
    } catch (err) {
      this.logger.warn(
        `News scout failed for ${context.region_id}: ${(err as Error).message}`,
      );
      return '';
    }
  }
}
