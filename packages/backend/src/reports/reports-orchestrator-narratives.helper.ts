/**
 * AI narrative generation stage for the reports orchestrator.
 *
 * Handles the entitlement gate, synthesis-narrative + per-market narrative
 * generation (run concurrently), the empty-narrative retry/hard-fail guard, and
 * attaching per-market narratives back onto populatedData/comparisons.
 * Extracted verbatim from the orchestrator; behavior unchanged.
 */

import type { GenerateReportDto } from './dto/generate-report.dto';
import type { ReportTemplate } from './reports.service';
import { buildNarrativeTemplateVars } from './reports-narrative-template-vars';
import { resolveReportType } from './reports-orchestrator-v2-routing';
import { generatePerMarketNarratives } from './reports-per-market-narratives';
import { updateGenerationStage } from './reports-orchestrator-persistence.helper';
import type { PriorityWeightedResult } from './reports-market-comparison';
import type { ReportDeps } from './reports-orchestrator.types';

export interface NarrativeGenerationParams {
  deps: ReportDeps;
  dto: GenerateReportDto;
  reportId: string;
  template: ReportTemplate;
  userId: string;
  userTier?: string;
  scores: any;
  scoreContexts: any;
  marketMetrics: Record<string, any>;
  signalSummary: any;
  newsResult: any;
  compNewsRaw: Record<string, any>;
  comparisons: Record<string, any>;
  populatedData: any;
  priorities: any[];
  priorityWeightedWinner: PriorityWeightedResult | null;
}

/**
 * Stage 9 — generate AI narratives (synthesis + per-market). Returns the
 * synthesis narratives object (empty `{}` when the user lacks ai_insights) and
 * mutates `populatedData` / `comparisons` in place with per-market narratives.
 */
export async function generateReportNarratives(
  params: NarrativeGenerationParams,
): Promise<Record<string, any>> {
  const {
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
  } = params;
  const { supabase, logger } = deps;

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
        const formatted = deps.newsScoutService.formatNewsForPrompt(compNews, {
          maxNewsItems: 3,
          includeIndicators: true,
          includeSignals: false,
          includeNational: false,
        });
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
      .select('investment_goal, experience_level, preferred_markets, full_name')
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
    const isComparison =
      reportType === 'comparison' &&
      !!dto.comparison_geographies &&
      dto.comparison_geographies.length > 0;

    // The report's own synthesis narrative and the per-market full
    // single-market narratives are INDEPENDENT outputs, so generate them
    // CONCURRENTLY instead of one after the other. Comparison narratives use
    // the faster flash model (the `reportType === 'comparison'` flag routes
    // them to AI_PURPOSES.REPORT_NARRATIVE_COMPARISON); single-market reports
    // keep their normal model.
    const synthesisPromise: Promise<Record<string, any>> = reportType
      ? deps.reportGenerationV2.generateNarratives(
          reportType,
          narrativeTemplateVars,
          reportType === 'comparison',
        )
      : Promise.resolve({} as Record<string, any>);

    // ── 9b. Per-market full single-market narratives (comparison reports) ─
    // A full single-market narrative for the primary AND each comparison
    // market so every market's deep-dive renders its REAL report. Guarded: a
    // failure leaves that market's narrative null and the report still
    // completes on the synthesis alone.
    const perMarketPromise = isComparison
      ? generatePerMarketNarratives({
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
          comparisons: dto.comparison_geographies!.map((g) => ({
            geo: g,
            scores: comparisons[g.id]?.scores,
            scoreContexts: comparisons[g.id]?.score_contexts,
            metrics: comparisons[g.id]?.current || {},
            news: compNewsRaw[g.id],
          })),
          userProfile,
          benchmarks: populatedData.benchmarks,
          isComparisonReport: true,
        }).catch((perMarketError: any) => {
          logger.warn(
            `Per-market narrative block failed, continuing with synthesis only: ${perMarketError?.message || perMarketError}`,
          );
          return null;
        })
      : Promise.resolve(null);

    const [synthResult, perMarket] = await Promise.all([
      synthesisPromise,
      perMarketPromise,
    ]);
    aiNarratives = synthResult;

    // ── Harden: never ship an ai_insights-entitled report with EMPTY
    // narratives. If every section failed (e.g. AI provider outage / 402),
    // the result holds only `_meta` — retry once, then throw so the report is
    // marked `failed` (by the catch below) instead of silently persisted as a
    // blank `ready` report.
    const realNarrativeKeys = (n: Record<string, any>) =>
      Object.keys(n).filter((k) => k !== '_meta' && k !== '__model_used');
    if (reportType && realNarrativeKeys(aiNarratives).length === 0) {
      logger.warn(
        `[Report] ${reportId}: narrative generation returned no sections — retrying once`,
      );
      aiNarratives = await deps.reportGenerationV2.generateNarratives(
        reportType,
        narrativeTemplateVars,
        reportType === 'comparison',
      );
      if (realNarrativeKeys(aiNarratives).length === 0) {
        throw new Error(
          'AI narrative generation produced no sections (provider unavailable); report not saved as ready.',
        );
      }
    }

    // populatedData.comparisons IS the same `comparisons` object, so these
    // mutations land in the single persistence write below.
    if (perMarket?.primary) {
      populatedData.primary_market_narrative = perMarket.primary;
    }
    if (perMarket) {
      for (const [geoId, narrative] of Object.entries(perMarket.byGeoId)) {
        if (comparisons[geoId]) {
          comparisons[geoId].ai_narrative = narrative;
        }
      }
    }
  }

  return aiNarratives;
}
