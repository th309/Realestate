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
 *
 * The individual pipeline stages live in `reports-orchestrator-*.helper.ts`
 * files; this module wires them together and owns the top-level progress
 * updates and error handling.
 */

import type { GenerateReportDto } from './dto/generate-report.dto';
import type { ReportTemplate } from './reports.service';
import { generateAllScoreContexts } from './reports-score-context';
import {
  assessDataCoverage,
  assemblePopulatedData,
} from './reports-data-assembly';
import type { ReportDeps } from './reports-orchestrator.types';
import {
  fetchPrimaryMarketData,
  buildComparisonMarketData,
} from './reports-orchestrator-data-fetch.helper';
import {
  attachBenchmarks,
  computePriorityWeightedWinner,
  fetchPartnerRecommendations,
  fetchBriefingContext,
} from './reports-orchestrator-enrichment.helper';
import { generateReportNarratives } from './reports-orchestrator-narratives.helper';
import {
  updateGenerationStage,
  persistCompletedReport,
} from './reports-orchestrator-persistence.helper';

// Re-export the dependency contract so existing importers keep working.
export type { ReportDeps } from './reports-orchestrator.types';

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
    const {
      scores,
      marketMetrics,
      metricProvenance,
      historicalData,
      newsResult,
    } = await fetchPrimaryMarketData(deps, dto, geoType, allRequiredMetrics);

    await updateGenerationStage(
      supabase,
      reportId,
      'scouting_news',
      'Scouting recent news and economic signals...',
    );

    // ── 2. Fetch comparison geography data (parallel per-geography) ────
    const { comparisons, compNewsRaw } = await buildComparisonMarketData(
      deps,
      dto,
      allRequiredMetrics,
    );

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
    await attachBenchmarks(supabase, logger, dto, populatedData);

    // ── 7. Priority-weighted winner (comparison reports) ───────────────
    const priorities = dto.priorities || dto.user_inputs?.priorities || [];
    const priorityWeightedWinner = computePriorityWeightedWinner(
      dto,
      comparisons,
      marketMetrics,
      scores,
      priorities,
      populatedData,
    );

    // ── 8. Partner recommendations ─────────────────────────────────────
    (populatedData as any).recommendations = await fetchPartnerRecommendations(
      deps,
      dto,
      scores,
    );

    // ── 8b. Optional market briefing for narrative consistency ─────────
    await fetchBriefingContext(supabase, logger, dto);

    // ── 9. AI narratives ───────────────────────────────────────────────
    await updateGenerationStage(
      supabase,
      reportId,
      'generating_analysis',
      'Generating deep market analysis...',
    );
    const aiNarratives = await generateReportNarratives({
      deps,
      dto,
      reportId,
      template,
      userId,
      userTier,
      scores,
      scoreContexts,
      marketMetrics,
      signalSummary,
      newsResult,
      compNewsRaw,
      comparisons,
      populatedData,
      priorities,
      priorityWeightedWinner,
    });

    // ── 10. Persist completed report ───────────────────────────────────
    await updateGenerationStage(
      supabase,
      reportId,
      'finalizing',
      'Finalizing your personalized report...',
    );
    const generationTime = Date.now() - startTime;
    await persistCompletedReport(
      supabase,
      reportId,
      populatedData,
      aiNarratives,
      scores,
      generationTime,
    );

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
