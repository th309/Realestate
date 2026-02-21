/**
 * Reports Orchestrator
 *
 * The core async report generation pipeline, extracted from ReportsService.
 * Orchestrates data fetching, score contextualization, benchmark assembly,
 * priority-weighted comparison, partner recommendations, and AI narrative
 * generation, then persists the completed report.
 *
 * All service dependencies are passed as a typed `ReportDeps` object so this
 * module stays free of NestJS decorators and can be unit-tested in isolation.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type { ScoringService } from '../scoring/scoring.service';
import type { ClaudeService } from './claude.service';
import type { ClaudeNewsService } from './claude-news.service';
import type { EntitlementsService } from '../entitlements/entitlements.service';
import type { PartnersService } from '../partners/partners.service';
import type { GenerateReportDto } from './dto/generate-report.dto';
import type { ReportTemplate } from './reports.service';
import { generateAllScoreContexts } from './reports-score-context';
import {
  PriorityWeightedResult,
  calculatePriorityWeightedWinner,
} from './reports-market-comparison';
import {
  fetchMarketMetrics,
  fetchStateBenchmark,
  fetchNationalBenchmark,
  fetchHistoricalData,
} from './reports-data-fetcher';
import { assessDataCoverage, assemblePopulatedData } from './reports-data-assembly';
import { buildNarrativeTemplateVars } from './reports-narrative-template-vars';
import type { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import type { TimeSeriesService } from '../timeseries/timeseries.service';
import type { MetricResolutionService } from '../metric-resolution/metric-resolution.service';

/** All service dependencies required by the orchestrator. */
export interface ReportDeps {
  supabase: SupabaseClient;
  logger: Logger;
  scoringService: ScoringService;
  claudeService: ClaudeService;
  claudeNewsService: ClaudeNewsService;
  entitlementsService: EntitlementsService;
  partnersService: PartnersService;
  marketSnapshotService: MarketSnapshotService;
  timeSeriesService: TimeSeriesService;
  metricResolutionService: MetricResolutionService;
}

/**
 * Run the full report generation pipeline for a single report.
 *
 * On success the report row is updated with status='ready'.
 * On failure the report row is updated with status='failed'.
 */
export async function generateReportAsync(
  deps: ReportDeps,
  reportId: string,
  template: ReportTemplate,
  dto: GenerateReportDto,
  startTime: number,
  userId: string,
  userTier?: string,
): Promise<void> {
  const { supabase, logger } = deps;

  try {
    const geoType = dto.primary_geography.type as 'metro' | 'county' | 'zip';
    const requiredMetrics = template.config?.data_requirements?.current_metrics || [];
    const demographics = template.config?.data_requirements?.demographics || [];
    const allRequiredMetrics = [...requiredMetrics, ...demographics, 'census', 'population', 'median_income'];

    // ── 1. Parallel data fetch: scores, metrics, historical, news ──────
    const newsTimeout = (promise: Promise<any>, ms: number) =>
      Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('News scouting timed out')), ms))]);

    const [scores, marketMetrics, historicalData, newsSettled] = await Promise.all([
      deps.scoringService.getScore(dto.primary_geography.id, geoType, undefined, { components: true }),
      fetchMarketMetrics(supabase, deps.marketSnapshotService, dto.primary_geography.id, geoType, allRequiredMetrics, deps.metricResolutionService),
      fetchHistoricalData(deps.timeSeriesService, dto.primary_geography.id, geoType),
      newsTimeout(
        deps.claudeNewsService.getOrScoutNews(
          dto.primary_geography.id, geoType, dto.primary_geography.name,
          dto.primary_geography.state || '',
          { includeNationalContext: true, maxNewsItems: 10, lookbackDays: 90 },
        ),
        60_000,
      ).catch((err: any) => {
        logger.warn(`News scouting failed/timed out for ${dto.primary_geography.name}: ${err?.message || err}`);
        return null;
      }),
    ]);

    const newsResult = newsSettled;

    // ── 2. Fetch comparison geography data (parallel per-geography) ────
    const comparisons: Record<string, any> = {};
    if (dto.comparison_geographies && dto.comparison_geographies.length > 0) {
      const compResults = await Promise.all(
        dto.comparison_geographies.map(async (compGeo) => {
          const compGeoType = compGeo.type as 'metro' | 'county' | 'zip';
          const [compMetrics, compHistorical, compScores] = await Promise.all([
            fetchMarketMetrics(supabase, deps.marketSnapshotService, compGeo.id, compGeoType, allRequiredMetrics, deps.metricResolutionService),
            fetchHistoricalData(deps.timeSeriesService, compGeo.id, compGeoType),
            deps.scoringService.getScore(compGeo.id, compGeoType, undefined, { components: true }),
          ]);
          return { id: compGeo.id, geography: compGeo, current: compMetrics, historical: compHistorical, scores: compScores };
        }),
      );
      for (const comp of compResults) {
        comparisons[comp.id] = { geography: comp.geography, current: comp.current, historical: comp.historical, scores: comp.scores };
      }
    }

    const signalSummary = newsResult
      ? deps.claudeNewsService.summarizeSignals(newsResult)
      : null;

    // ── 3. Score contexts ──────────────────────────────────────────────
    const scoreContexts = scores
      ? generateAllScoreContexts(
          {
            homeready: scores.scores.homeready,
            investoredge: scores.scores.investoredge,
            markethealth: scores.scores.markethealth,
          },
          {
            geography_type: geoType,
            median_price: marketMetrics.median_listing_price || marketMetrics.zhvi,
          },
        )
      : null;

    // ── 4. Data coverage assessment ────────────────────────────────────
    const dataCoverage = await assessDataCoverage(supabase, marketMetrics, geoType, dto);

    // ── 5. Assemble populatedData ──────────────────────────────────────
    const populatedData = assemblePopulatedData(
      marketMetrics, historicalData, scores, scoreContexts, newsResult, signalSummary, comparisons, dataCoverage,
    );

    // ── 6. Fetch benchmarks ────────────────────────────────────────────
    try {
      const benchmarks: Record<string, any> = {};
      if (dto.primary_geography.state) {
        const stateMetrics = await fetchStateBenchmark(supabase, dto.primary_geography.state);
        if (stateMetrics && Object.keys(stateMetrics).length > 0) {
          benchmarks.state = stateMetrics;
        }
      }
      const nationalMetrics = await fetchNationalBenchmark(supabase);
      if (nationalMetrics && Object.keys(nationalMetrics).length > 0) {
        benchmarks.national = nationalMetrics;
      }
      populatedData.benchmarks = benchmarks;
    } catch (benchmarkError) {
      logger.warn('Failed to fetch benchmarks, continuing with empty:', benchmarkError);
    }

    // ── 7. Priority-weighted winner (comparison reports) ───────────────
    const priorities = dto.priorities || dto.user_inputs?.priorities || [];
    let priorityWeightedWinner: PriorityWeightedResult | null = null;

    if (priorities.length > 0 && dto.comparison_geographies && dto.comparison_geographies.length > 0) {
      const comparisonMarketData = dto.comparison_geographies.map(compGeo => ({
        geography: { id: compGeo.id, name: compGeo.name },
        metrics: comparisons[compGeo.id]?.current || {},
        scores: comparisons[compGeo.id]?.scores,
      }));

      priorityWeightedWinner = calculatePriorityWeightedWinner(
        {
          geography: { id: dto.primary_geography.id, name: dto.primary_geography.name },
          metrics: marketMetrics,
          scores,
        },
        comparisonMarketData,
        priorities,
        dto.user_type,
      );

      if (priorityWeightedWinner) {
        (populatedData as any).priority_weighted_winner = priorityWeightedWinner;
      }
    }

    (populatedData as any).priorities = priorities;

    // ── 8. Partner recommendations ─────────────────────────────────────
    try {
      const partnerContextTypes = ['affordability', 'timing', 'stability', 'growth', 'verdict'];
      if (dto.user_type === 'investor') {
        partnerContextTypes.push('cash_flow', 'entry_point', 'risk', 'pro_forma');
      }

      const recommendations = await deps.partnersService.getRecommendationsForReport(
        partnerContextTypes,
        {
          geographyType: dto.primary_geography.type,
          geographyId: dto.primary_geography.id,
          templateVars: {
            geography_name: dto.primary_geography.name || '',
            ...(scores
              ? {
                  homeready_score: String(Math.round(scores.scores.homeready.score)),
                  investoredge_score: String(Math.round(scores.scores.investoredge.score)),
                  markethealth_score: String(Math.round(scores.scores.markethealth.score)),
                }
              : {}),
          },
        },
      );

      (populatedData as any).recommendations = recommendations;
    } catch (partnerError) {
      logger.warn('Failed to fetch partner recommendations, continuing without them:', partnerError);
      (populatedData as any).recommendations = {};
    }

    // ── 9. AI narratives ───────────────────────────────────────────────
    let aiNarratives = {};
    const aiAccess = await deps.entitlementsService.checkAccess(userId, userTier || null, ['feature:ai_insights']);
    const hasAiInsights = aiAccess.access['feature:ai_insights']?.level === 'full';

    if (!hasAiInsights) {
      logger.log(`[Report] Skipping AI narratives — user ${userId} does not have ai_insights`);
    }

    if (hasAiInsights && template.config.ai_config?.narrative_sections) {
      const newsContext = newsResult
        ? deps.claudeNewsService.formatNewsForPrompt(newsResult, {
            maxNewsItems: 5,
            includeIndicators: true,
            includeSignals: true,
            includeNational: true,
          })
        : 'No recent news available for this market.';

      aiNarratives = await deps.claudeService.generateNarratives(
        template.config.ai_config.narrative_sections,
        buildNarrativeTemplateVars(dto, scores, scoreContexts, marketMetrics, newsContext, signalSummary, priorities, priorityWeightedWinner, comparisons),
      );
    }

    // ── 10. Persist completed report ───────────────────────────────────
    const generationTime = Date.now() - startTime;
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'ready',
        populated_data: populatedData,
        ai_narrative: aiNarratives,
        ai_model_used: 'claude-sonnet-4-20250514',
        homeready_score: scores?.scores.homeready.score != null ? Math.round(scores.scores.homeready.score) : null,
        investoredge_score: scores?.scores.investoredge.score != null ? Math.round(scores.scores.investoredge.score) : null,
        scores_snapshot: scores,
        generation_completed_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        data_as_of_date: new Date().toISOString().split('T')[0],
        confidence_level: populatedData.data_coverage?.is_limited ? 'moderate' : 'high',
      })
      .eq('id', reportId);

    if (updateError) {
      throw updateError;
    }

    logger.log(`Report ${reportId} generated in ${generationTime}ms`);
  } catch (error) {
    logger.error(`Report generation failed for ${reportId}:`, error);

    await supabase
      .from('reports')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error during generation',
      })
      .eq('id', reportId);
  }
}
