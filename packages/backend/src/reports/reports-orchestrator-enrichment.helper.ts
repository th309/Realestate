/**
 * Populated-data enrichment stages for the reports orchestrator.
 *
 * Each function corresponds to one orchestrator stage (benchmarks,
 * priority-weighted winner, partner recommendations, market briefing) and was
 * extracted verbatim. All soft-fail exactly as before so a single missing input
 * never fails the report.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateReportDto } from './dto/generate-report.dto';
import {
  fetchStateBenchmark,
  fetchNationalBenchmark,
} from './reports-data-fetcher';
import {
  PriorityWeightedResult,
  calculatePriorityWeightedWinner,
} from './reports-market-comparison';
import type { ReportDeps } from './reports-orchestrator.types';

/**
 * Stage 6 — fetch state + national benchmarks and attach them to
 * `populatedData.benchmarks`. Benchmark failures are logged and swallowed.
 */
export async function attachBenchmarks(
  supabase: SupabaseClient,
  logger: Logger,
  dto: GenerateReportDto,
  populatedData: any,
): Promise<void> {
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
}

/**
 * Stage 7 — compute the priority-weighted winner across primary + comparison
 * markets (comparison reports only) and attach it plus `priorities` to
 * `populatedData`. Returns the winner (or null) for downstream narrative vars.
 */
export function computePriorityWeightedWinner(
  dto: GenerateReportDto,
  comparisons: Record<string, any>,
  marketMetrics: Record<string, any>,
  scores: any,
  priorities: any[],
  populatedData: any,
): PriorityWeightedResult | null {
  let priorityWeightedWinner: PriorityWeightedResult | null = null;

  if (
    priorities.length > 0 &&
    dto.comparison_geographies &&
    dto.comparison_geographies.length > 0
  ) {
    const comparisonMarketData = dto.comparison_geographies.map((compGeo) => ({
      geography: { id: compGeo.id, name: compGeo.name },
      metrics: comparisons[compGeo.id]?.current || {},
      scores: comparisons[compGeo.id]?.scores,
    }));

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
      populatedData.priority_weighted_winner = priorityWeightedWinner;
    }
  }

  populatedData.priorities = priorities;

  return priorityWeightedWinner;
}

/**
 * Stage 8 — fetch partner recommendations for the report's context types.
 * Failures degrade to an empty object (non-fatal).
 */
export async function fetchPartnerRecommendations(
  deps: ReportDeps,
  dto: GenerateReportDto,
  scores: any,
): Promise<any> {
  try {
    const partnerContextTypes = [
      'affordability',
      'timing',
      'stability',
      'growth',
      'verdict',
    ];
    if (dto.user_type === 'investor') {
      partnerContextTypes.push('cash_flow', 'entry_point', 'risk', 'pro_forma');
    }

    return await deps.partnersService.getRecommendationsForReport(
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
  } catch (partnerError) {
    deps.logger.warn(
      'Failed to fetch partner recommendations, continuing without them:',
      partnerError,
    );
    return {};
  }
}

/**
 * Stage 8b — optional market briefing for narrative consistency. If a briefing
 * exists, its stance/risk context is available to align AI narratives. Missing
 * briefing is NOT an error — reports always work without one.
 */
export async function fetchBriefingContext(
  supabase: SupabaseClient,
  logger: Logger,
  dto: GenerateReportDto,
): Promise<any> {
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
  return briefingContext;
}
