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
import type { NewsScoutService } from './news-scout.service';
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
import {
  assessDataCoverage,
  assemblePopulatedData,
} from './reports-data-assembly';
import { buildNarrativeTemplateVars } from './reports-narrative-template-vars';
import type { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import type { TimeSeriesService } from '../timeseries/timeseries.service';
import type { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import type { ReportGenerationV2Service } from './report-generation-v2.service';
import { resolveReportType } from './reports-orchestrator-v2-routing';
import { generatePerMarketNarratives } from './reports-per-market-narratives';

/**
 * Update the report row with a generation stage for real-time progress tracking.
 * The frontend connects via SSE to poll these values and show pipeline progress.
 */
async function updateGenerationStage(
  supabase: SupabaseClient,
  reportId: string,
  stage: string,
  detail?: string,
): Promise<void> {
  await supabase
    .from('reports')
    .update({
      generation_stage: stage,
      generation_stage_detail: detail ?? null,
    })
    .eq('id', reportId);
}

/** All service dependencies required by the orchestrator. */
export interface ReportDeps {
  supabase: SupabaseClient;
  logger: Logger;
  scoringService: ScoringService;
  newsScoutService: NewsScoutService;
  entitlementsService: EntitlementsService;
  partnersService: PartnersService;
  marketSnapshotService: MarketSnapshotService;
  timeSeriesService: TimeSeriesService;
  metricResolutionService: MetricResolutionService;
  reportGenerationV2: ReportGenerationV2Service;
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
    const requiredMetrics =
      template.config?.data_requirements?.current_metrics || [];
    const demographics = template.config?.data_requirements?.demographics || [];
    const allRequiredMetrics = [
      ...requiredMetrics,
      ...demographics,
      'census',
      'population',
      'median_income',
    ];

    // ── 1. Parallel data fetch: scores, metrics, historical, news ──────
    await updateGenerationStage(
      supabase,
      reportId,
      'fetching_data',
      'Fetching market data from 6 sources...',
    );
    const newsTimeout = (promise: Promise<any>, ms: number) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('News scouting timed out')), ms),
        ),
      ]);

    const [scores, marketMetricsResult, historicalData, newsSettled] =
      await Promise.all([
        deps.scoringService.getScore(
          dto.primary_geography.id,
          geoType,
          undefined,
          { components: true },
        ),
        fetchMarketMetrics(
          supabase,
          deps.marketSnapshotService,
          dto.primary_geography.id,
          geoType,
          allRequiredMetrics,
          deps.metricResolutionService,
        ),
        fetchHistoricalData(
          deps.timeSeriesService,
          dto.primary_geography.id,
          geoType,
        ),
        newsTimeout(
          deps.newsScoutService.getOrScoutNews(
            dto.primary_geography.id,
            geoType,
            dto.primary_geography.name,
            dto.primary_geography.state || '',
            {
              includeNationalContext: true,
              maxNewsItems: 10,
              lookbackDays: 90,
            },
          ),
          60_000,
        ).catch((err: any) => {
          logger.warn(
            `News scouting failed/timed out for ${dto.primary_geography.name}: ${err?.message || err}`,
          );
          return null;
        }),
      ]);

    const marketMetrics = marketMetricsResult.metrics;
    const metricProvenance = marketMetricsResult.provenance;
    const newsResult = newsSettled;

    await updateGenerationStage(
      supabase,
      reportId,
      'scouting_news',
      'Scouting recent news and economic signals...',
    );

    // ── 2. Fetch comparison geography data (parallel per-geography) ────
    // Comparison reports fetch the FULL per-market data set (metrics + historical
    // + scores + news + score contexts) so each market can later get its own full
    // single-market narrative — i.e. every tab reads like an individual report.
    const comparisons: Record<string, any> = {};
    // Raw news per comparison geo, kept locally for per-market narrative
    // generation (the trimmed `realtime` shape is what gets stored on the report).
    const compNewsRaw: Record<string, any> = {};
    if (dto.comparison_geographies && dto.comparison_geographies.length > 0) {
      const compResults = await Promise.all(
        dto.comparison_geographies.map(async (compGeo) => {
          const compGeoType = compGeo.type as 'metro' | 'county' | 'zip';
          const [compMetricsResult, compHistorical, compScores, compNews] =
            await Promise.all([
              fetchMarketMetrics(
                supabase,
                deps.marketSnapshotService,
                compGeo.id,
                compGeoType,
                allRequiredMetrics,
                deps.metricResolutionService,
              ),
              fetchHistoricalData(
                deps.timeSeriesService,
                compGeo.id,
                compGeoType,
              ),
              deps.scoringService.getScore(compGeo.id, compGeoType, undefined, {
                components: true,
              }),
              newsTimeout(
                deps.newsScoutService.getOrScoutNews(
                  compGeo.id,
                  compGeoType,
                  compGeo.name,
                  compGeo.state || '',
                  {
                    includeNationalContext: false,
                    maxNewsItems: 8,
                    lookbackDays: 90,
                  },
                ),
                60_000,
              ).catch((err: any) => {
                logger.warn(
                  `News scouting failed/timed out for comparison ${compGeo.name}: ${err?.message || err}`,
                );
                return null;
              }),
            ]);
          return {
            id: compGeo.id,
            geography: compGeo,
            current: compMetricsResult.metrics,
            currentProvenance: compMetricsResult.provenance,
            historical: compHistorical,
            scores: compScores,
            news: compNews,
          };
        }),
      );
      for (const comp of compResults) {
        const compScoreContexts = comp.scores
          ? generateAllScoreContexts(
              { propertyiq: comp.scores.scores?.propertyiq ?? undefined },
              {
                geography_type: comp.geography.type as
                  | 'metro'
                  | 'county'
                  | 'zip',
                median_price:
                  comp.current.median_listing_price || comp.current.zhvi,
              },
            )
          : null;
        const compSignalSummary = comp.news
          ? deps.newsScoutService.summarizeSignals(comp.news)
          : null;
        compNewsRaw[comp.id] = comp.news;
        comparisons[comp.id] = {
          geography: comp.geography,
          current: comp.current,
          metric_provenance: comp.currentProvenance,
          historical: comp.historical,
          scores: comp.scores,
          score_contexts: compScoreContexts,
          realtime: comp.news
            ? {
                news: comp.news.local_news,
                indicators: comp.news.economic_indicators,
                signals: comp.news.market_signals,
                national_context: comp.news.national_context,
                signal_summary: compSignalSummary,
                fetched_at: comp.news.scout_metadata?.search_timestamp,
              }
            : null,
        };

        // Build a COMPLETE, standalone-shaped populated_data for THIS market via
        // the SAME assemblePopulatedData path a 1-geo report uses, so every
        // comparison tab renders like an individual report: cleaned
        // scores.propertyiq.score (not the raw double-nested getScore shape),
        // `current` with display aliases (home_value, median_rent, …),
        // historical + realtime. The frontend reads this slice directly — no
        // overlaying the primary, no shape-patching. (`scores` above is kept raw
        // because the priority-weighted-winner calc still reads it.)
        const compDataCoverage = await assessDataCoverage(
          supabase,
          comp.current,
          comp.geography.type,
          { ...dto, primary_geography: comp.geography } as GenerateReportDto,
        );
        const compPopulatedData = assemblePopulatedData(
          comp.current,
          comp.historical,
          comp.scores,
          compScoreContexts,
          comp.news,
          compSignalSummary,
          {},
          compDataCoverage,
        );
        if (Object.keys(comp.currentProvenance || {}).length > 0) {
          (compPopulatedData as any).metric_provenance = comp.currentProvenance;
        }
        comparisons[comp.id].populated_data = compPopulatedData;
      }
    }

    const signalSummary = newsResult
      ? deps.newsScoutService.summarizeSignals(newsResult)
      : null;

    // ── 3. Score contexts ──────────────────────────────────────────────
    await updateGenerationStage(
      supabase,
      reportId,
      'computing_insights',
      'Calculating affordability percentile across 400+ metros...',
    );
    const scoreContexts = scores
      ? generateAllScoreContexts(
          {
            propertyiq: scores.scores.propertyiq ?? undefined,
          },
          {
            geography_type: geoType,
            median_price:
              marketMetrics.median_listing_price || marketMetrics.zhvi,
          },
        )
      : null;

    // ── 4. Data coverage assessment ────────────────────────────────────
    const dataCoverage = await assessDataCoverage(
      supabase,
      marketMetrics,
      geoType,
      dto,
    );

    // ── 5. Assemble populatedData ──────────────────────────────────────
    const populatedData = assemblePopulatedData(
      marketMetrics,
      historicalData,
      scores,
      scoreContexts,
      newsResult,
      signalSummary,
      comparisons,
      dataCoverage,
    );

    // Include metric provenance so the frontend can display source badges
    // (e.g. "Fallback: Census ACS" or "Inherited from metro")
    if (Object.keys(metricProvenance).length > 0) {
      (populatedData as any).metric_provenance = metricProvenance;
    }

    // ── 6. Fetch benchmarks ────────────────────────────────────────────
    await updateGenerationStage(
      supabase,
      reportId,
      'comparing_benchmarks',
      'Identifying historical market parallels...',
    );
    try {
      const benchmarks: Record<string, any> = {};
      if (dto.primary_geography.state) {
        const stateMetrics = await fetchStateBenchmark(
          supabase,
          dto.primary_geography.state,
        );
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
      logger.warn(
        'Failed to fetch benchmarks, continuing with empty:',
        benchmarkError,
      );
    }

    // ── 7. Priority-weighted winner (comparison reports) ───────────────
    const priorities = dto.priorities || dto.user_inputs?.priorities || [];
    let priorityWeightedWinner: PriorityWeightedResult | null = null;

    if (
      priorities.length > 0 &&
      dto.comparison_geographies &&
      dto.comparison_geographies.length > 0
    ) {
      const comparisonMarketData = dto.comparison_geographies.map(
        (compGeo) => ({
          geography: { id: compGeo.id, name: compGeo.name },
          metrics: comparisons[compGeo.id]?.current || {},
          scores: comparisons[compGeo.id]?.scores,
        }),
      );

      priorityWeightedWinner = calculatePriorityWeightedWinner(
        {
          geography: {
            id: dto.primary_geography.id,
            name: dto.primary_geography.name,
          },
          metrics: marketMetrics,
          scores,
        },
        comparisonMarketData,
        priorities,
        dto.user_type,
      );

      if (priorityWeightedWinner) {
        (populatedData as any).priority_weighted_winner =
          priorityWeightedWinner;
      }
    }

    (populatedData as any).priorities = priorities;

    // ── 8. Partner recommendations ─────────────────────────────────────
    try {
      const partnerContextTypes = [
        'affordability',
        'timing',
        'stability',
        'growth',
        'verdict',
      ];
      if (dto.user_type === 'investor') {
        partnerContextTypes.push(
          'cash_flow',
          'entry_point',
          'risk',
          'pro_forma',
        );
      }

      const recommendations =
        await deps.partnersService.getRecommendationsForReport(
          partnerContextTypes,
          {
            geographyType: dto.primary_geography.type,
            geographyId: dto.primary_geography.id,
            templateVars: {
              geography_name: dto.primary_geography.name || '',
              ...(scores
                ? {
                    homeready_score: scores.scores.homeready
                      ? String(Math.round(scores.scores.homeready.score))
                      : 'N/A',
                    investoredge_score: scores.scores.investoredge
                      ? String(Math.round(scores.scores.investoredge.score))
                      : 'N/A',
                    markethealth_score: scores.scores.markethealth
                      ? String(Math.round(scores.scores.markethealth.score))
                      : 'N/A',
                  }
                : {}),
            },
          },
        );

      (populatedData as any).recommendations = recommendations;
    } catch (partnerError) {
      logger.warn(
        'Failed to fetch partner recommendations, continuing without them:',
        partnerError,
      );
      (populatedData as any).recommendations = {};
    }

    // ── 8b. Optional market briefing for narrative consistency ─────────
    // If a briefing exists for this geography, inject its stance/risk context
    // into narrative prompts so AI-generated text aligns with intelligence.
    // Missing briefing is NOT an error — reports always work without one.
    let briefingContext: any = null;
    try {
      const { data: briefing } = await supabase
        .from('market_briefings')
        .select(
          'market_stance, stance_signals, risk_flags, narrative_summary, news_snapshot',
        )
        .eq('geography_id', dto.primary_geography.id)
        .eq('is_latest', true)
        .single();

      if (briefing) {
        briefingContext = briefing;
        logger.log(
          `Using market briefing for ${dto.primary_geography.name} (stance: ${briefing.market_stance})`,
        );
      }
    } catch {
      // No briefing available — generate report with original narrative flow.
      // This is completely normal and expected when intelligence is off.
    }

    // ── 9. AI narratives ───────────────────────────────────────────────
    await updateGenerationStage(
      supabase,
      reportId,
      'generating_analysis',
      'Generating deep market analysis...',
    );
    let aiNarratives = {};
    // `userTier` is a TRUSTED server-derived override (e.g. platform API by
    // validated API-key type); null for the app path → tier resolves from the
    // validated userId. It is NEVER sourced from a client header (the bug).
    const aiAccess = await deps.entitlementsService.checkAccess(
      userId,
      userTier || null,
      ['feature:ai_insights'],
    );
    const hasAiInsights =
      aiAccess.access['feature:ai_insights']?.level === 'full';

    if (!hasAiInsights) {
      logger.log(
        `[Report] Skipping AI narratives — user ${userId} does not have ai_insights`,
      );
    }

    if (hasAiInsights) {
      const newsContext = newsResult
        ? deps.newsScoutService.formatNewsForPrompt(newsResult, {
            maxNewsItems: 5,
            includeIndicators: true,
            includeSignals: true,
            includeNational: true,
          })
        : 'No recent news available for this market.';

      // Synthesis news context = primary + EACH comparison market's news +
      // economic indicators. The cross-market synthesis was previously fed only
      // the primary's news, so head-to-head + indicators couldn't speak to the
      // other markets. (Single-market reports have no comparison_geographies, so
      // this is just the primary's news — unchanged.)
      let synthesisNewsContext = newsContext;
      if (dto.comparison_geographies?.length) {
        const compBlocks: string[] = [];
        for (const compGeo of dto.comparison_geographies) {
          const compNews = compNewsRaw[compGeo.id];
          if (!compNews) continue;
          const formatted = deps.newsScoutService.formatNewsForPrompt(
            compNews,
            {
              maxNewsItems: 3,
              includeIndicators: true,
              includeSignals: false,
              includeNational: false,
            },
          );
          if (formatted) compBlocks.push(`### ${compGeo.name}\n${formatted}`);
        }
        if (compBlocks.length) {
          const primaryBlock =
            newsResult && !newsContext.startsWith('No recent news')
              ? `### ${dto.primary_geography.name}\n${newsContext}`
              : '';
          synthesisNewsContext = [primaryBlock, ...compBlocks]
            .filter(Boolean)
            .join('\n\n');
        }
      }

      // Fetch user onboarding profile for personalized narratives
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select(
          'investment_goal, experience_level, preferred_markets, full_name',
        )
        .eq('id', userId)
        .single();

      const narrativeTemplateVars = buildNarrativeTemplateVars(
        dto,
        scores,
        scoreContexts,
        marketMetrics,
        synthesisNewsContext,
        signalSummary,
        priorities,
        priorityWeightedWinner,
        comparisons,
        userProfile,
        populatedData.benchmarks,
      );

      await updateGenerationStage(
        supabase,
        reportId,
        'building_outline',
        'Building analytical outline...',
      );

      const reportType = resolveReportType(template, dto);

      if (reportType) {
        aiNarratives = await deps.reportGenerationV2.generateNarratives(
          reportType,
          narrativeTemplateVars,
        );
      }

      // ── 9b. Per-market full single-market narratives (comparison reports) ─
      // report.ai_narrative above is the cross-market SYNTHESIS (used by the
      // summary). Here we ALSO generate a full single-market narrative for the
      // primary AND each comparison market so every market's tab renders the
      // REAL single-market report. Additive + fully guarded: any failure leaves
      // that market's narrative null and the report still completes.
      if (
        reportType === 'comparison' &&
        dto.comparison_geographies &&
        dto.comparison_geographies.length > 0
      ) {
        try {
          await updateGenerationStage(
            supabase,
            reportId,
            'generating_analysis',
            'Writing a full report for each market...',
          );
          const perMarket = await generatePerMarketNarratives({
            deps: {
              reportGenerationV2: deps.reportGenerationV2,
              newsScoutService: deps.newsScoutService,
              logger,
            },
            dto,
            primary: {
              geo: dto.primary_geography,
              scores,
              scoreContexts,
              metrics: marketMetrics,
              news: newsResult,
            },
            comparisons: dto.comparison_geographies.map((g) => ({
              geo: g,
              scores: comparisons[g.id]?.scores,
              scoreContexts: comparisons[g.id]?.score_contexts,
              metrics: comparisons[g.id]?.current || {},
              news: compNewsRaw[g.id],
            })),
            userProfile,
            benchmarks: populatedData.benchmarks,
          });
          // populatedData.comparisons IS the same `comparisons` object, so these
          // mutations land in the single persistence write below.
          if (perMarket.primary) {
            (populatedData as any).primary_market_narrative = perMarket.primary;
          }
          for (const [geoId, narrative] of Object.entries(perMarket.byGeoId)) {
            if (comparisons[geoId]) {
              comparisons[geoId].ai_narrative = narrative;
            }
          }
        } catch (perMarketError: any) {
          logger.warn(
            `Per-market narrative block failed, continuing with synthesis only: ${perMarketError?.message || perMarketError}`,
          );
        }
      }
    }

    // ── 10. Persist completed report ───────────────────────────────────
    await updateGenerationStage(
      supabase,
      reportId,
      'finalizing',
      'Finalizing your personalized report...',
    );
    const generationTime = Date.now() - startTime;
    // Extract model name from narratives metadata (set by ReportAiService/v2)
    const aiModelUsed = (aiNarratives as any).__model_used || 'unknown';
    // Clean metadata key before persisting to DB
    delete (aiNarratives as any).__model_used;

    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'ready',
        populated_data: populatedData,
        ai_narrative: aiNarratives,
        ai_model_used: aiModelUsed,
        homeready_score:
          scores?.scores.homeready?.score != null
            ? Math.round(scores.scores.homeready.score)
            : null,
        investoredge_score:
          scores?.scores.investoredge?.score != null
            ? Math.round(scores.scores.investoredge.score)
            : null,
        scores_snapshot: scores,
        generation_completed_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        data_as_of_date: new Date().toISOString().split('T')[0],
        confidence_level: populatedData.data_coverage?.is_limited
          ? 'moderate'
          : 'high',
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
