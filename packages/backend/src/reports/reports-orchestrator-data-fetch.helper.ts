/**
 * Parallel data-fetch stages for the reports orchestrator.
 *
 * `fetchPrimaryMarketData` gathers scores/metrics/historical/news for the
 * primary geography. `buildComparisonMarketData` gathers the FULL per-market
 * data set for each comparison geography and assembles a standalone-shaped
 * `populated_data` slice per market. Extracted verbatim from the orchestrator.
 */

import type { GenerateReportDto } from './dto/generate-report.dto';
import { generateAllScoreContexts } from './reports-score-context';
import {
  fetchMarketMetrics,
  fetchHistoricalData,
} from './reports-data-fetcher';
import {
  assessDataCoverage,
  assemblePopulatedData,
} from './reports-data-assembly';
import type { ReportDeps } from './reports-orchestrator.types';

type GeoType = 'metro' | 'county' | 'zip';

/** Reject a news-scouting promise after `ms` so a slow provider can't stall a report. */
const newsTimeout = (promise: Promise<any>, ms: number) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('News scouting timed out')), ms),
    ),
  ]);

export interface PrimaryMarketData {
  scores: any;
  marketMetrics: Record<string, any>;
  metricProvenance: Record<string, any>;
  historicalData: any;
  newsResult: any;
}

/**
 * Stage 1 — parallel fetch of scores, metrics, historical data, and news for
 * the primary geography. News failures/timeouts degrade to null (non-fatal).
 */
export async function fetchPrimaryMarketData(
  deps: ReportDeps,
  dto: GenerateReportDto,
  geoType: GeoType,
  allRequiredMetrics: string[],
): Promise<PrimaryMarketData> {
  const { supabase, logger } = deps;

  const [scores, marketMetricsResult, historicalData, newsSettled] =
    await Promise.all([
      deps.scoringService.getScore(
        dto.primary_geography.id,
        geoType,
        undefined,
        {
          components: true,
        },
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

  return {
    scores,
    marketMetrics: marketMetricsResult.metrics,
    metricProvenance: marketMetricsResult.provenance,
    historicalData,
    newsResult: newsSettled,
  };
}

export interface ComparisonMarketData {
  comparisons: Record<string, any>;
  compNewsRaw: Record<string, any>;
}

/**
 * Stage 2 — fetch the FULL per-market data set (metrics + historical + scores +
 * news + score contexts) for every comparison geography and build a complete,
 * standalone-shaped `populated_data` slice per market so each tab renders like
 * an individual report.
 */
export async function buildComparisonMarketData(
  deps: ReportDeps,
  dto: GenerateReportDto,
  allRequiredMetrics: string[],
): Promise<ComparisonMarketData> {
  const { supabase, logger } = deps;

  const comparisons: Record<string, any> = {};
  // Raw news per comparison geo, kept locally for per-market narrative
  // generation (the trimmed `realtime` shape is what gets stored on the report).
  const compNewsRaw: Record<string, any> = {};

  if (dto.comparison_geographies && dto.comparison_geographies.length > 0) {
    const compResults = await Promise.all(
      dto.comparison_geographies.map(async (compGeo) => {
        const compGeoType = compGeo.type as GeoType;
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
              geography_type: comp.geography.type as GeoType,
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

  return { comparisons, compNewsRaw };
}
