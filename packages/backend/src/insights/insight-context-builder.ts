/**
 * Insight Context Builder
 *
 * Assembles the InsightContext object from scores, metrics, and benchmarks.
 * Extracted from InsightsService to keep file sizes under the 300-line limit.
 */

import { Logger } from '@nestjs/common';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';
import { resolveRegionDisplayName } from '../common/geo';
import { InsightContext } from './insights.types';

/** Metrics fetched for insight context */
export const INSIGHT_METRICS = [
  'home_value',
  'rent_index',
  'unemployment_rate',
  'days_on_market',
  'for_sale_inventory',
  'home_value_yoy',
  'population_growth',
  'median_income',
] as const;

/** Subset of metrics used for state/national benchmarks */
const BENCHMARK_METRICS = [
  'home_value',
  'rent_index',
  'unemployment_rate',
  'median_income',
];

const logger = new Logger('InsightContextBuilder');

/**
 * Assemble the InsightContext for a single region by fetching scores,
 * metrics, and benchmarks from ScoringService and MetricResolutionService.
 */
export async function buildInsightContext(
  regionId: string,
  geoLevel: string,
  scoringService: ScoringService,
  metricResolution: MetricResolutionService,
  geoChain: GeographyChainService,
): Promise<InsightContext> {
  const geo = geoLevel as GeoLevel;

  // Fetch scores and metrics in parallel
  const [scoreResult, metricsResult] = await Promise.all([
    scoringService
      .getScore(regionId, geoLevel as any, undefined, { components: true })
      .catch((err) => {
        logger.warn(`Score fetch failed for ${geoLevel}/${regionId}: ${err}`);
        return null;
      }),
    metricResolution
      .resolveMetricBatch([...INSIGHT_METRICS], geo, regionId)
      .catch((err) => {
        logger.warn(`Metric batch failed for ${geoLevel}/${regionId}: ${err}`);
        return {} as Record<string, any>;
      }),
  ]);

  const scores = extractScores(scoreResult);
  const scoreComponents = extractScoreComponents(scoreResult);
  const keyMetrics = buildKeyMetrics(metricsResult);
  const benchmarks = await fetchBenchmarks(
    regionId,
    geo,
    metricResolution,
    geoChain,
  );

  return {
    region_name: resolveRegionDisplayName(
      geoLevel,
      regionId,
      scoreResult?.location_name,
    ),
    region_id: regionId,
    geo_level: geo as InsightContext['geo_level'],
    scores,
    score_components: scoreComponents,
    key_metrics: keyMetrics,
    benchmarks,
  };
}

/**
 * Extract the three score values from a ScoreResult.
 */
function extractScores(scoreResult: any): InsightContext['scores'] {
  return {
    propertyiq: scoreResult?.scores?.propertyiq?.score ?? null,
  };
}

/**
 * Flatten per-score-type component breakdowns into a single record.
 */
function extractScoreComponents(
  scoreResult: any,
): InsightContext['score_components'] {
  const components: InsightContext['score_components'] = {};

  for (const scoreType of ['propertyiq'] as const) {
    const singleScore = scoreResult?.scores?.[scoreType];
    if (Array.isArray(singleScore?.components)) {
      for (const comp of singleScore.components) {
        components[comp.component] = {
          status: comp.status,
          value: comp.score,
        };
      }
    }
  }

  return components;
}

/**
 * Build the key_metrics record from resolved metric values.
 */
function buildKeyMetrics(
  metricsResult: Record<string, any>,
): InsightContext['key_metrics'] {
  const keyMetrics: InsightContext['key_metrics'] = {};

  for (const metricId of INSIGHT_METRICS) {
    const resolved = metricsResult[metricId];
    keyMetrics[metricId] = {
      value: resolved?.value ?? null,
      yoy_change: null,
      format: inferMetricFormat(metricId),
    };
  }

  return keyMetrics;
}

/**
 * Infer a display format based on the metric name.
 */
function inferMetricFormat(metricId: string): string {
  if (metricId.includes('rate') || metricId.includes('yoy')) return 'percent';
  if (metricId.includes('value') || metricId.includes('income'))
    return 'currency';
  return 'number';
}

/**
 * Fetch state-level and national-level benchmarks for comparison.
 * Uses the geography crosswalk to find the parent state.
 */
async function fetchBenchmarks(
  regionId: string,
  geoLevel: GeoLevel,
  metricResolution: MetricResolutionService,
  geoChain: GeographyChainService,
): Promise<InsightContext['benchmarks']> {
  const stateAvg: Record<string, number> = {};
  const nationalAvg: Record<string, number> = {};

  // Find state FIPS via geography chain
  let stateFips: string | null = null;
  if (geoLevel !== 'state' && geoLevel !== 'national') {
    const chain = await geoChain.getInheritanceChain(geoLevel, regionId);
    const stateStep = chain.find((step) => step.level === 'state');
    stateFips = stateStep?.id ?? null;
  } else if (geoLevel === 'state') {
    stateFips = regionId;
  }

  // Fetch state and national benchmarks in parallel
  const [stateResult, nationalResult] = await Promise.all([
    stateFips
      ? metricResolution
          .resolveMetricBatch(BENCHMARK_METRICS, 'state', stateFips)
          .catch(() => ({}) as Record<string, any>)
      : Promise.resolve({} as Record<string, any>),
    metricResolution
      .resolveMetricBatch(BENCHMARK_METRICS, 'national', 'national')
      .catch(() => ({}) as Record<string, any>),
  ]);

  for (const metricId of BENCHMARK_METRICS) {
    if (stateResult[metricId]?.value != null) {
      stateAvg[metricId] = stateResult[metricId].value!;
    }
    if (nationalResult[metricId]?.value != null) {
      nationalAvg[metricId] = nationalResult[metricId].value!;
    }
  }

  return { state_avg: stateAvg, national_avg: nationalAvg };
}
