/**
 * Insights Service
 *
 * Generates, caches, and serves AI-powered market insights using DeepSeek
 * via the OpenAI SDK. Assembles context from ScoringService and
 * MetricResolutionService, then feeds prompt templates to the AI model.
 *
 * Heavy lifting is delegated to:
 * - insight-context-builder.ts  — assembles InsightContext from scores/metrics
 * - insight-batch-generator.ts  — batch generation with concurrency control
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
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
} from './insight-prompts';

/** Maps insight type to its prompt builder function */
const PROMPT_BUILDERS: Record<InsightType, (ctx: InsightContext) => string> = {
  market_take: buildMarketTakePrompt,
  score_explanation: buildScoreExplanationPrompt,
  trend_interpretation: buildTrendInterpretationPrompt,
  market_overview: buildMarketOverviewPrompt,
  archetype_match: buildMarketOverviewPrompt,
};

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private aiClient: Anthropic | null = null;
  private readonly aiModel: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
    private readonly geoChain: GeographyChainService,
  ) {
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.aiModel =
      this.configService.get<string>('AI_MODEL') || 'claude-opus-4-7';

    if (anthropicKey) {
      this.aiClient = new Anthropic({ apiKey: anthropicKey });
      this.logger.log(
        `Anthropic initialized for insights (model: ${this.aiModel})`,
      );
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured - insight generation disabled',
      );
    }
  }

  /**
   * Retrieve a cached insight or generate a fresh one for the given region.
   */
  async getInsight(
    regionId: string,
    geoLevel: string,
    insightType: string,
    archetypeId?: string,
  ): Promise<MarketInsight | null> {
    // Check cache first (works regardless of AI availability).
    let query = this.supabase
      .from('market_insights')
      .select('*')
      .eq('region_id', regionId)
      .eq('geo_level', geoLevel)
      .eq('insight_type', insightType)
      .gt('expires_at', new Date().toISOString());

    query = query.eq('archetype_id', archetypeId || '__none__');

    const { data: cached } = await query.limit(1).single();

    if (cached) return cached as MarketInsight;

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

    // No AI client configured — serve the deterministic fallback (HTTP 200).
    if (!this.aiClient) return makeFallback();

    // Generate fresh insight
    const content = await this.generateSingleInsight(
      context,
      insightType as InsightType,
    );

    // Generation failed/empty — serve the fallback instead of throwing 404.
    // Do not cache the fallback; a later request regenerates with the AI client.
    if (!content) return makeFallback();

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    const row = {
      region_id: regionId,
      geo_level: geoLevel,
      insight_type: insightType,
      archetype_id: archetypeId || '__none__',
      content,
      model: this.aiModel,
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

  /**
   * Generate insights for all regions at a given geography level.
   * Intended for batch/cron usage. Delegates to insight-batch-generator.
   */
  async generateBatchInsights(
    geoLevel: string,
  ): Promise<{ generated: number; failed: number; duration_ms: number }> {
    if (!this.aiClient) {
      return { generated: 0, failed: 0, duration_ms: 0 };
    }

    return generateBatchInsights(
      geoLevel,
      this.supabase,
      this.aiModel,
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
   * Call the AI model with the appropriate prompt template and return
   * the generated text.
   */
  async generateSingleInsight(
    context: InsightContext,
    insightType: InsightType,
  ): Promise<string> {
    if (!this.aiClient) return '';

    const buildPrompt = PROMPT_BUILDERS[insightType];
    const prompt = buildPrompt(context);
    const maxTokens = insightType === 'market_overview' ? 1200 : 200;

    try {
      const response = await this.aiClient.messages.create({
        model: this.aiModel,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content?.[0];
      return block && block.type === 'text' ? block.text : '';
    } catch (err) {
      this.logger.error(
        `Anthropic generation failed for ${context.region_id}/${insightType} (model=${this.aiModel}): ${(err as Error).message}`,
      );
      return '';
    }
  }
}
