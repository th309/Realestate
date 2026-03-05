/**
 * Research Ranking Handlers
 *
 * Handlers for get_rankings and rank_by_metric tools.
 * Extracted from research-tool-handlers.ts for file size compliance.
 *
 * rank_by_metric enriches results with population + sales volume context
 * so the research agent can detect anomalies in small/illiquid markets.
 */

import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import type { GeographyLevel, ScoreType } from '../../scoring/formula-weights';
import type { GeoLevel } from '../../metric-resolution/metric-resolution.types';

export async function handleGetRankings(
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

export async function handleRankByMetric(
  input: Record<string, unknown>,
  metricResolution: MetricResolutionService,
): Promise<string> {
  const metricId = input.metric_id as string;
  const geoLevel = input.geography_level as GeoLevel;
  const order = (input.order as string) || 'desc';
  const limit = Math.min((input.limit as number) || 10, 25);

  const allValues = await metricResolution.resolveMetricForAllGeos(
    metricId,
    geoLevel,
  );

  if (allValues.size === 0) {
    return JSON.stringify({
      metric_id: metricId,
      geography_level: geoLevel,
      count: 0,
      rankings: [],
      warning: `No data found for metric "${metricId}" at ${geoLevel} level`,
    });
  }

  const entries = Array.from(allValues.entries()).map(([id, resolved]) => ({
    location_id: id,
    value: resolved.value,
    source: resolved.source,
    date: resolved.date,
  }));

  entries.sort((a, b) =>
    order === 'asc'
      ? (a.value ?? 0) - (b.value ?? 0)
      : (b.value ?? 0) - (a.value ?? 0),
  );

  const top = entries.slice(0, limit);

  // Enrich top results with population + sales volume for anomaly detection.
  // Without this context, extreme values in tiny markets look like opportunities.
  const contextMetrics =
    metricId !== 'population' && metricId !== 'home_sales'
      ? ['population', 'home_sales']
      : metricId === 'population'
        ? ['home_sales']
        : ['population'];

  const enriched = await Promise.all(
    top.map(async (entry) => {
      const context: Record<string, number | null> = {};
      try {
        const batch = await metricResolution.resolveMetricBatch(
          contextMetrics,
          geoLevel,
          entry.location_id,
        );
        for (const [key, resolved] of Object.entries(batch)) {
          context[key] = resolved.value;
        }
      } catch {
        // Context enrichment is best-effort
      }
      return { ...entry, context };
    }),
  );

  // Compute median of the ranked metric to flag statistical outliers
  const allSorted = entries
    .map((e) => e.value)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const median =
    allSorted.length > 0 ? allSorted[Math.floor(allSorted.length / 2)] : null;

  return JSON.stringify({
    metric_id: metricId,
    geography_level: geoLevel,
    order,
    total_regions: allValues.size,
    median_value: median,
    count: enriched.length,
    rankings: enriched,
    analysis_note:
      'Rankings include population and home_sales context. ' +
      'Extreme values in markets with low population (<50K) or low sales ' +
      'volume (<100/yr) are likely statistical noise, not real opportunities.',
  });
}
