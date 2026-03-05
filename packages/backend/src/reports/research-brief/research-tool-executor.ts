/**
 * Research Tool Executor
 *
 * Handles the actual data fetching for each research tool invocation.
 * Called by ResearchBriefService during the Claude tool-use loop.
 * Each method maps to a tool defined in research-tools.ts.
 */

import { Logger } from '@nestjs/common';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { TimeSeriesService } from '../../timeseries/timeseries.service';
import { ClaudeNewsService } from '../claude-news.service';
import type { GeographyLevel, ScoreType } from '../../scoring/formula-weights';
import type { GeoLevel } from '../../metric-resolution/metric-resolution.types';

const logger = new Logger('ResearchToolExecutor');

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

/**
 * Execute a tool call by name and return the JSON result string.
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  scoring: ScoringService,
  metricResolution: MetricResolutionService,
  timeSeries: TimeSeriesService,
  newsService: ClaudeNewsService | null,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_market_snapshot':
        return await handleGetMarketSnapshot(
          toolInput,
          scoring,
          metricResolution,
        );
      case 'compare_markets':
        return await handleCompareMarkets(toolInput, scoring, metricResolution);
      case 'get_timeseries':
        return await handleGetTimeseries(toolInput, timeSeries);
      case 'get_rankings':
        return await handleGetRankings(toolInput, scoring);
      case 'search_news':
        return await handleSearchNews(toolInput, newsService);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    logger.error(`Tool execution failed for ${toolName}: ${error.message}`);
    return JSON.stringify({
      error: `Tool ${toolName} failed: ${error.message}`,
    });
  }
}

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleGetMarketSnapshot(
  input: Record<string, unknown>,
  scoring: ScoringService,
  metricResolution: MetricResolutionService,
): Promise<string> {
  const regionId = input.region_id as string;
  const geoLevel = input.geography_level as GeographyLevel & GeoLevel;
  const metricIds = (input.metrics as string[]) || DEFAULT_METRICS;

  // Fetch scores and metrics in parallel
  const [scoreResult, metricsResult] = await Promise.all([
    scoring
      .getScore(regionId, geoLevel, undefined, { components: true })
      .catch(() => null),
    metricResolution
      .resolveMetricBatch(metricIds, geoLevel, regionId)
      .catch(() => ({})),
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

  return JSON.stringify({
    region_id: regionId,
    geography_level: geoLevel,
    scores,
    metrics,
  });
}

async function handleCompareMarkets(
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

async function handleGetTimeseries(
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
    data: data.slice(0, 36), // Cap at 36 points to limit token usage
  });
}

async function handleGetRankings(
  input: Record<string, unknown>,
  scoring: ScoringService,
): Promise<string> {
  const scoreType = input.score_type as ScoreType;
  const geoLevel = input.geography_level as GeographyLevel;
  const limit = Math.min((input.limit as number) || 10, 25);
  const state = input.state as string | undefined;

  const topMarkets = await scoring.getTopMarkets(
    geoLevel,
    scoreType,
    limit,
    undefined,
    state,
  );

  return JSON.stringify({
    score_type: scoreType,
    geography_level: geoLevel,
    state: state || 'all',
    count: topMarkets?.length ?? 0,
    rankings: (topMarkets || []).map((m: any) => ({
      location_id: m.location_id,
      location_name: m.location_name,
      score: m.score,
      grade: m.grade,
    })),
  });
}

async function handleSearchNews(
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

  // Use a synthetic region ID for caching (news service needs one)
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
    signals: result.market_signals.slice(0, 3).map((s) => ({
      type: s.signal_type,
      headline: s.headline,
      description: s.description,
    })),
  });
}
