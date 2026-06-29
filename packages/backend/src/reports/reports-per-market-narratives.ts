/**
 * Per-Market Narratives (comparison reports)
 *
 * For a COMPARISON report, every market — the primary AND each comparison market
 * — gets a FULL single-market AI narrative, so the frontend can render the real
 * single-market report for each market's deep-dive tab. The comparison report's
 * own `ai_narrative` stays the cross-market synthesis (used for the summary).
 *
 * Each market is generated independently and guarded: a failure for one market
 * (or the whole block) leaves that market's narrative null and the report still
 * completes. The primary + all comparison markets generate CONCURRENTLY (each
 * narrative's sections already fan out internally); transient provider 429s are
 * absorbed by the per-section retryWithBackoff. Comparison narratives use the
 * faster flash model via `isComparisonReport`.
 */

import type { Logger } from '@nestjs/common';
import type { GenerateReportDto } from './dto/generate-report.dto';
import type { ReportGenerationV2Service } from './report-generation-v2.service';
import type { NewsScoutService } from './news-scout.service';
import { buildNarrativeTemplateVars } from './reports-narrative-template-vars';

type SingleMarketReportType = 'homeready' | 'investoredge';

/**
 * The single-market report type a 1-geo report of this user_type would use,
 * matching the frontend single-market templates (investoredge_v2 / homeready_v2)
 * so the generated narrative's section keys line up with what gets rendered.
 */
export function resolveSingleMarketReportType(
  dto: GenerateReportDto,
): SingleMarketReportType {
  return dto.user_type === 'investor' ? 'investoredge' : 'homeready';
}

interface GeoRef {
  id: string;
  name: string;
  type: string;
  state?: string;
}

/** One market's inputs for single-market narrative generation. */
export interface MarketNarrativeInput {
  geo: GeoRef;
  scores: any;
  scoreContexts: any;
  metrics: Record<string, any>;
  news: any;
}

export interface PerMarketNarrativesResult {
  primary: Record<string, any> | null;
  byGeoId: Record<string, Record<string, any>>;
}

export async function generatePerMarketNarratives(args: {
  deps: {
    reportGenerationV2: ReportGenerationV2Service;
    newsScoutService: NewsScoutService;
    logger: Logger;
  };
  dto: GenerateReportDto;
  primary: MarketNarrativeInput;
  comparisons: MarketNarrativeInput[];
  userProfile: any;
  benchmarks?: Record<string, any>;
  /** Comparison reports use the faster flash model for per-market narratives. */
  isComparisonReport?: boolean;
}): Promise<PerMarketNarrativesResult> {
  const { deps, dto, primary, comparisons, userProfile, benchmarks } = args;
  const singleType = resolveSingleMarketReportType(dto);

  const buildVars = (m: MarketNarrativeInput): Record<string, any> => {
    // Treat THIS market as the primary geography, with no nested comparisons,
    // so the narrative reads as a standalone single-market report.
    const singleDto = {
      ...dto,
      primary_geography: m.geo,
      comparison_geographies: [],
    } as GenerateReportDto;
    const newsContext = m.news
      ? deps.newsScoutService.formatNewsForPrompt(m.news, {
          maxNewsItems: 5,
          includeIndicators: true,
          includeSignals: true,
          includeNational: true,
        })
      : 'No recent news available for this market.';
    const signal = m.news
      ? deps.newsScoutService.summarizeSignals(m.news)
      : null;
    return buildNarrativeTemplateVars(
      singleDto,
      m.scores,
      m.scoreContexts,
      m.metrics,
      newsContext,
      signal,
      [],
      null,
      {},
      userProfile,
      benchmarks,
    );
  };

  const genOne = async (
    m: MarketNarrativeInput,
  ): Promise<Record<string, any>> => {
    const n = await deps.reportGenerationV2.generateNarratives(
      singleType,
      buildVars(m),
      args.isComparisonReport === true,
    );
    delete (n as any).__model_used;
    return n;
  };

  // Generate the primary + every comparison market CONCURRENTLY; each is
  // independently guarded so one market failing leaves only its narrative null.
  const settle = async (
    m: MarketNarrativeInput,
  ): Promise<Record<string, any> | null> => {
    try {
      return await genOne(m);
    } catch (e: any) {
      deps.logger.warn(
        `Per-market narrative failed for ${m.geo.name}: ${e?.message || e}`,
      );
      return null;
    }
  };

  const [primaryNarrative, ...compNarratives] = await Promise.all([
    settle(primary),
    ...comparisons.map(settle),
  ]);

  const byGeoId: Record<string, Record<string, any>> = {};
  comparisons.forEach((m, i) => {
    const n = compNarratives[i];
    if (n) byGeoId[m.geo.id] = n;
  });

  return { primary: primaryNarrative, byGeoId };
}
