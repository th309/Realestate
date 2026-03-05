/**
 * Research Tool Handlers
 *
 * Handler functions for market snapshot, compare, timeseries, and news tools.
 * Ranking handlers (get_rankings, rank_by_metric) are in research-ranking-handlers.ts.
 */

import { Logger } from '@nestjs/common';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { TimeSeriesService } from '../../timeseries/timeseries.service';
import { ClaudeNewsService } from '../claude-news.service';
import type { GeographyLevel } from '../../scoring/formula-weights';
import type { GeoLevel } from '../../metric-resolution/metric-resolution.types';

export {
  handleGetRankings,
  handleRankByMetric,
} from './research-ranking-handlers';

const logger = new Logger('ResearchToolHandlers');

/** Core metrics to fetch when none are specified */
const DEFAULT_METRICS = [
  'home_value',
  'rent_index',
  'days_on_market',
  'inventory',
  'price_cuts',
  'unemployment_rate',
  'median_income',
  'population_growth',
];

export async function handleGetMarketSnapshot(
  input: Record<string, unknown>,
  scoring: ScoringService,
  metricResolution: MetricResolutionService,
): Promise<string> {
  const regionId = input.region_id as string;
  const geoLevel = input.geography_level as GeographyLevel & GeoLevel;
  const metricIds = (input.metrics as string[]) || DEFAULT_METRICS;

  const [scoreResult, metricsResult] = await Promise.all([
    scoring
      .getScore(regionId, geoLevel, undefined, { components: true })
      .catch((err) => {
        logger.warn(
          `Score fetch failed for ${regionId}/${geoLevel}: ${err.message}`,
        );
        return null;
      }),
    metricResolution
      .resolveMetricBatch(metricIds, geoLevel, regionId)
      .catch((err) => {
        logger.warn(
          `Metric batch failed for ${regionId}/${geoLevel}: ${err.message}`,
        );
        return {};
      }),
  ]);

  const scores = scoreResult
    ? {
        homeready: scoreResult.scores.homeready?.score ?? null,
        homeready_grade: scoreResult.scores.homeready?.grade ?? null,
        investoredge: scoreResult.scores.investoredge?.score ?? null,
        investoredge_grade: scoreResult.scores.investoredge?.grade ?? null,
        markethealth: scoreResult.scores.markethealth?.score ?? null,
        markethealth_grade: scoreResult.scores.markethealth?.grade ?? null,
        location_name: scoreResult.location_name,
      }
    : null;

  const metrics: Record<
    string,
    { value: number | null; source: string; date: string | null }
  > = {};
  for (const [key, resolved] of Object.entries(metricsResult)) {
    metrics[key] = {
      value: resolved.value,
      source: resolved.source,
      date: resolved.date,
    };
  }

  const warnings: string[] = [];
  if (!scores)
    warnings.push(
      `No scores available for region ${regionId} at ${geoLevel} level.`,
    );
  if (Object.keys(metrics).length === 0)
    warnings.push(`No metrics resolved for region ${regionId}.`);

  return JSON.stringify({
    region_id: regionId,
    geography_level: geoLevel,
    scores,
    metrics,
    ...(warnings.length > 0 && { warnings }),
  });
}

export async function handleCompareMarkets(
  input: Record<string, unknown>,
  scoring: ScoringService,
  metricResolution: MetricResolutionService,
): Promise<string> {
  const regions = input.regions as Array<{
    region_id: string;
    geography_level: string;
  }>;
  const results = await Promise.all(
    regions.map(async (region) => {
      const geoLevel = region.geography_level as GeographyLevel & GeoLevel;
      const [scoreResult, metricsResult] = await Promise.all([
        scoring.getScore(region.region_id, geoLevel).catch(() => null),
        metricResolution
          .resolveMetricBatch(DEFAULT_METRICS, geoLevel, region.region_id)
          .catch(() => ({})),
      ]);

      const metricsSimple: Record<string, number | null> = {};
      for (const [key, resolved] of Object.entries(metricsResult)) {
        metricsSimple[key] = resolved.value;
      }

      return {
        region_id: region.region_id,
        geography_level: geoLevel,
        location_name: scoreResult?.location_name ?? region.region_id,
        homeready: scoreResult?.scores.homeready?.score ?? null,
        investoredge: scoreResult?.scores.investoredge?.score ?? null,
        markethealth: scoreResult?.scores.markethealth?.score ?? null,
        metrics: metricsSimple,
      };
    }),
  );

  return JSON.stringify({ comparison: results });
}

export async function handleGetTimeseries(
  input: Record<string, unknown>,
  timeSeries: TimeSeriesService,
): Promise<string> {
  const metricId = input.metric_id as string;
  const regionId = input.region_id as string;
  const geoLevel = input.geography_level as string;
  const lastPoints = (input.last_points as number) || 24;

  const data = await timeSeries.getTimeSeries(
    metricId,
    geoLevel,
    regionId,
    undefined,
    undefined,
    undefined,
    lastPoints,
  );

  return JSON.stringify({
    metric_id: metricId,
    region_id: regionId,
    geography_level: geoLevel,
    points: data.length,
    data: data.slice(0, 36),
  });
}

export async function handleSearchNews(
  input: Record<string, unknown>,
  newsService: ClaudeNewsService | null,
): Promise<string> {
  if (!newsService || !newsService.isAvailable()) {
    return JSON.stringify({
      available: false,
      message: 'News scouting service is not configured. Skipping news data.',
    });
  }

  const regionName = input.region_name as string;
  const geoLevel = input.geography_level as string;
  const state = (input.state as string) || '';

  const syntheticId = regionName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const result = await newsService.getOrScoutNews(
    syntheticId,
    geoLevel as any,
    regionName,
    state,
    { maxNewsItems: 5, lookbackDays: 60 },
  );

  if (!result) {
    return JSON.stringify({ available: true, news: [], signals: [] });
  }

  return JSON.stringify({
    available: true,
    news: result.local_news.slice(0, 5).map((n) => ({
      headline: n.headline,
      summary: n.summary,
      category: n.category,
      sentiment: n.sentiment,
      impact: n.impact_on_real_estate,
    })),
    economic_indicators: result.economic_indicators.slice(0, 5).map((e) => ({
      indicator: e.indicator_name,
      level: e.geography_level,
      value: e.current_value,
      change: e.change_description,
      housing_impact: `${e.impact_on_housing}: ${e.impact_explanation}`,
    })),
    signals: result.market_signals.slice(0, 3).map((s) => ({
      type: s.signal_type,
      headline: s.headline,
      description: s.description,
    })),
    national_context: result.national_context || null,
  });
}
