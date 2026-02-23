/**
 * Briefing Generator Service
 *
 * Generates a complete market briefing for a single geography. Called by the
 * cron job (Task 8) for batch generation and by on-demand generation (Task 14).
 */

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import {
  MarketBriefing, MetricSnapshot, NationalBenchmarks,
  NewsItem, BRIEFING_METRIC_IDS,
} from './market-intelligence.types';
import { computeMarketStance, StanceSignal } from './engines/market-stance.engine';
import { computeRiskFlags, RiskFlag } from './engines/risk-flags.engine';
import {
  buildMetricsSnapshot, extractStanceMetrics, extractRiskMetrics,
  calculateFreshness, buildNarrativePrompt, buildSuggestedQuestionsPrompt,
  parseSuggestedQuestions, buildFallbackNarrative,
} from './briefing-generator.helpers';

const LLM_TIMEOUT_MS = 30_000;

@Injectable()
export class BriefingGeneratorService {
  private readonly logger = new Logger(BriefingGeneratorService.name);

  constructor(
    private readonly metricResolution: MetricResolutionService,
    private readonly supabase: SupabaseService,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Generate a complete market briefing. Resilient to partial failures. */
  async generateBriefing(
    geographyId: string,
    geographyType: 'metro' | 'county',
    geographyName: string,
    nationalBenchmarks: NationalBenchmarks,
  ): Promise<MarketBriefing> {
    const startTime = Date.now();

    // 1. Resolve all briefing metrics
    const resolvedMetrics = await this.resolveMetricsSafe(geographyType, geographyId);

    // 2. Build metrics snapshot
    const metricsSnapshot = buildMetricsSnapshot(resolvedMetrics);

    // 3. Compute market stance (deterministic)
    const stanceInput = extractStanceMetrics(resolvedMetrics);
    const stanceResult = computeMarketStance(stanceInput, {
      vacancy_rate: nationalBenchmarks.vacancy_rate,
      appreciation_yoy: nationalBenchmarks.appreciation_yoy,
    });

    // 4. Compute risk flags (deterministic)
    const riskInput = extractRiskMetrics(resolvedMetrics);
    const riskFlags = computeRiskFlags(riskInput, {
      vacancy_rate: nationalBenchmarks.vacancy_rate,
      unemployment_rate: nationalBenchmarks.unemployment_rate,
    }, null);

    // 5. Fetch recent news
    const newsSnapshot = await this.fetchRecentNews(geographyId);

    // 6. Generate narrative via LLM
    const metricsCount = Object.values(metricsSnapshot).filter(m => m.value !== null).length;
    const narrative = await this.generateNarrative(
      geographyName, stanceResult.stance, stanceResult.signals,
      riskFlags, metricsSnapshot, newsSnapshot, metricsCount,
    );

    // 7. Generate suggested questions via LLM
    const suggestedQuestions = await this.generateSuggestedQuestions(
      geographyName, stanceResult.stance,
    );

    // 8. Build and store briefing
    const generationTimeMs = Date.now() - startTime;
    const briefing: MarketBriefing = {
      id: '',
      geography_id: geographyId,
      geography_type: geographyType,
      geography_name: geographyName,
      generated_date: new Date().toISOString().split('T')[0],
      metrics_snapshot: metricsSnapshot,
      scores: {}, // TODO: Wire up scoring service in Task 8
      market_stance: stanceResult.stance,
      stance_signals: stanceResult.signals,
      risk_flags: riskFlags,
      narrative_summary: narrative,
      suggested_questions: suggestedQuestions,
      news_snapshot: newsSnapshot,
      metrics_count: metricsCount,
      data_freshness_days: calculateFreshness(metricsSnapshot),
      generation_time_ms: generationTimeMs,
    };

    briefing.id = await this.storeBriefing(briefing);

    this.logger.log(
      `Briefing generated for ${geographyName} (${geographyId}) in ${generationTimeMs}ms ` +
      `— stance=${stanceResult.stance}, metrics=${metricsCount}, risks=${riskFlags.length}`,
    );

    return briefing;
  }

  // -- Metric Resolution (resilient) ----------------------------------------

  private async resolveMetricsSafe(
    geoLevel: 'metro' | 'county',
    geoId: string,
  ): Promise<Record<string, ResolvedMetric>> {
    try {
      return await this.metricResolution.resolveMetricBatch(
        [...BRIEFING_METRIC_IDS], geoLevel, geoId,
      );
    } catch (err) {
      this.logger.error(`Metric resolution failed for ${geoLevel}/${geoId}: ${err.message}`);
      return {};
    }
  }

  // -- News Fetching --------------------------------------------------------

  private async fetchRecentNews(geographyId: string): Promise<NewsItem[]> {
    try {
      const client = this.supabase.getClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await client
        .from('market_news')
        .select('headline, source_name, published_at, summary, tags, sentiment')
        .contains('geography_ids', [geographyId])
        .gte('published_at', thirtyDaysAgo.toISOString())
        .order('published_at', { ascending: false })
        .limit(5);

      if (error || !data) return [];
      return data as NewsItem[];
    } catch (err) {
      this.logger.warn(`Failed to fetch news for ${geographyId}: ${err.message}`);
      return [];
    }
  }

  // -- LLM Narrative --------------------------------------------------------

  private async generateNarrative(
    geographyName: string, stance: string, signals: StanceSignal[],
    riskFlags: RiskFlag[], metricsSnapshot: Record<string, MetricSnapshot>,
    newsSnapshot: NewsItem[], metricsCount: number,
  ): Promise<string> {
    try {
      const newsHeadlines = newsSnapshot.map(
        n => `- ${n.headline} (${n.source_name}, ${n.sentiment})`,
      );
      const prompt = buildNarrativePrompt(
        geographyName, stance, signals, riskFlags, metricsSnapshot, newsHeadlines,
      );
      return await this.callLlm(prompt);
    } catch (err) {
      this.logger.warn(`LLM narrative failed for ${geographyName}: ${err.message}`);
      return buildFallbackNarrative(geographyName, stance, metricsCount);
    }
  }

  private async generateSuggestedQuestions(
    geographyName: string, stance: string,
  ): Promise<string[]> {
    try {
      const prompt = buildSuggestedQuestionsPrompt(geographyName, stance);
      const raw = await this.callLlm(prompt);
      return parseSuggestedQuestions(raw);
    } catch (err) {
      this.logger.warn(`LLM questions failed for ${geographyName}: ${err.message}`);
      return [];
    }
  }

  private async callLlm(prompt: string): Promise<string> {
    const [baseUrl, model, apiKey] = await Promise.all([
      this.appConfig.get('AI_BASE_URL', 'https://api.deepseek.com'),
      this.appConfig.get('AI_MODEL', 'deepseek-chat'),
      this.appConfig.get('DEEPSEEK_API_KEY'),
    ]);

    const client = new OpenAI({ baseURL: baseUrl, apiKey });

    const response = await Promise.race([
      client.chat.completions.create({
        model,
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM request timed out')), LLM_TIMEOUT_MS),
      ),
    ]);

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned empty response');
    return content;
  }

  // -- Database Storage -----------------------------------------------------

  private async storeBriefing(briefing: MarketBriefing): Promise<string> {
    try {
      const client = this.supabase.getClient();

      // Mark previous briefings as not latest
      await client
        .from('market_briefings')
        .update({ is_latest: false })
        .eq('geography_id', briefing.geography_id)
        .eq('is_latest', true);

      // Insert new briefing
      const { data, error } = await client
        .from('market_briefings')
        .insert({
          geography_id: briefing.geography_id,
          geography_type: briefing.geography_type,
          geography_name: briefing.geography_name,
          generated_date: briefing.generated_date,
          metrics_snapshot: briefing.metrics_snapshot,
          scores: briefing.scores,
          market_stance: briefing.market_stance,
          stance_signals: briefing.stance_signals,
          risk_flags: briefing.risk_flags,
          narrative_summary: briefing.narrative_summary,
          suggested_questions: briefing.suggested_questions,
          news_snapshot: briefing.news_snapshot,
          metrics_count: briefing.metrics_count,
          data_freshness_days: briefing.data_freshness_days,
          generation_time_ms: briefing.generation_time_ms,
          is_latest: true,
        })
        .select('id');

      if (error) {
        this.logger.error(`Failed to store briefing: ${error.message}`);
        return '';
      }
      return data?.[0]?.id ?? '';
    } catch (err) {
      this.logger.error(`Failed to store briefing: ${err.message}`);
      return '';
    }
  }
}
