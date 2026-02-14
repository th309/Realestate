/**
 * REPORT METRIC HELPERS
 *
 * Utilities for accessing metric data in reports with geo-level fallbacks.
 * Uses the same availability logic as the map.
 */

import { isMetricAvailableForGeo } from '@/app/map/config/metric-availability';
import type { GeoLevel } from '@/lib/data';
import type { ReportWithTemplate } from '../types';

/**
 * Geography hierarchy for fallback lookups (most specific to most general)
 */
const GEO_HIERARCHY: GeoLevel[] = ['zip', 'city', 'county', 'metro', 'state', 'national'];

/**
 * Get the parent geography level for fallback
 */
export function getParentGeoLevel(geoLevel: GeoLevel): GeoLevel | null {
  const index = GEO_HIERARCHY.indexOf(geoLevel);
  if (index === -1 || index >= GEO_HIERARCHY.length - 1) return null;
  return GEO_HIERARCHY[index + 1];
}

/**
 * Check if a metric is available at the report's geography level
 */
export function isMetricAvailableForReport(
  metricId: string,
  report: ReportWithTemplate
): boolean {
  const geoLevel = report.primary_geography_type as GeoLevel;
  return isMetricAvailableForGeo(metricId, geoLevel);
}

/**
 * Get the best available geo level for a metric
 * Returns the report's geo level if available, or the nearest parent level
 */
export function getBestGeoLevelForMetric(
  metricId: string,
  reportGeoLevel: GeoLevel
): GeoLevel | null {
  let currentLevel: GeoLevel | null = reportGeoLevel;

  while (currentLevel) {
    if (isMetricAvailableForGeo(metricId, currentLevel)) {
      return currentLevel;
    }
    currentLevel = getParentGeoLevel(currentLevel);
  }

  return null;
}

/**
 * Get a metric value from the report, checking if it's available
 * Returns null if metric is not available at this geo level
 */
export function getMetricValue(
  report: ReportWithTemplate,
  metricId: string
): number | null {
  const geoLevel = report.primary_geography_type as GeoLevel;

  // Check if metric is available at this geo level
  if (!isMetricAvailableForGeo(metricId, geoLevel)) {
    return null;
  }

  const value = report.populated_data?.current?.[metricId];
  if (value === undefined || value === null) return null;

  return typeof value === 'number' ? value : null;
}

/**
 * Get a metric value with fallback to benchmarks if not available at report level
 */
export function getMetricValueWithFallback(
  report: ReportWithTemplate,
  metricId: string
): { value: number | null; source: 'current' | 'state' | 'national' | null } {
  // First try current geography
  const currentValue = report.populated_data?.current?.[metricId];
  if (currentValue !== undefined && currentValue !== null) {
    return { value: Number(currentValue), source: 'current' };
  }

  // Try state benchmark
  const stateValue = report.populated_data?.benchmarks?.state?.[metricId];
  if (stateValue !== undefined && stateValue !== null) {
    return { value: Number(stateValue), source: 'state' };
  }

  // Try national benchmark
  const nationalValue = report.populated_data?.benchmarks?.national?.[metricId];
  if (nationalValue !== undefined && nationalValue !== null) {
    return { value: Number(nationalValue), source: 'national' };
  }

  return { value: null, source: null };
}

/**
 * Map of common metric ID aliases between template and actual data
 */
const METRIC_ALIASES: Record<string, string[]> = {
  zhvi: ['home_value', 'median_listing_price'],
  median_household_income: ['median_income'],
  net_migration: ['migration_net'],
  population_growth_yoy: ['population_growth'],
  unemployment_rate: ['unemployment'],
  job_growth_yoy: ['job_growth'],
  income_growth_yoy: ['income_growth'],
};

/**
 * Get a metric value, trying aliases if primary key not found
 */
export function getMetricWithAliases(
  report: ReportWithTemplate,
  metricId: string
): number | null {
  // Try primary metric ID
  const primaryValue = report.populated_data?.current?.[metricId];
  if (primaryValue !== undefined && primaryValue !== null) {
    return Number(primaryValue);
  }

  // Try aliases
  const aliases = METRIC_ALIASES[metricId] || [];
  for (const alias of aliases) {
    const aliasValue = report.populated_data?.current?.[alias];
    if (aliasValue !== undefined && aliasValue !== null) {
      return Number(aliasValue);
    }
  }

  return null;
}

/**
 * Check if any of the required metrics are available
 */
export function hasAnyMetric(
  report: ReportWithTemplate,
  metricIds: string[]
): boolean {
  return metricIds.some(id => getMetricWithAliases(report, id) !== null);
}

/**
 * Check if all required metrics are available
 */
export function hasAllMetrics(
  report: ReportWithTemplate,
  metricIds: string[]
): boolean {
  return metricIds.every(id => getMetricWithAliases(report, id) !== null);
}

/**
 * Trend direction type
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Trend data for displaying metric changes over time
 */
export interface MetricTrend {
  direction: TrendDirection;
  changePct: number;
  sparklineData?: number[];
}

/**
 * Get a metric value trying the primary ID and a list of aliases
 *
 * This is a convenience wrapper around getMetricWithAliases that accepts
 * an explicit list of aliases to try in order.
 */
export function getMetricValueWithAliases(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = []
): number | null {
  // Try primary ID first
  const primaryValue = getMetricWithAliases(report, metricId);
  if (primaryValue !== null) return primaryValue;

  // Try aliases
  for (const alias of aliases) {
    const aliasValue = getMetricWithAliases(report, alias);
    if (aliasValue !== null) return aliasValue;
  }

  return null;
}

/**
 * Get historical trend data for a metric, trying the primary ID and aliases
 *
 * Returns trend information including direction, percentage change, and
 * sparkline data points extracted from the report's historical data.
 */
export function getMetricTrend(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = []
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

  // Try primary ID and aliases
  const idsToTry = [metricId, ...aliases];

  for (const id of idsToTry) {
    const histData = historical[id];
    if (histData && histData.data && histData.data.length >= 2) {
      return {
        direction: histData.trend as TrendDirection,
        changePct: histData.change_pct,
        sparklineData: histData.data.map((d: { value: number }) => d.value),
      };
    }
  }

  return undefined;
}

/**
 * Result type for metric with geo fallback
 */
export interface MetricWithGeoFallback {
  value: number | null;
  /** The geography level the data came from (e.g., 'county' if zip wasn't available) */
  sourceGeo: GeoLevel | null;
  /** Human-readable label for the source (e.g., "County average") */
  sourceLabel: string | null;
  /** Whether this is from a fallback geography (not the report's primary geo) */
  isFallback: boolean;
}

/**
 * Geography level display names
 */
const GEO_LABELS: Record<GeoLevel, string> = {
  zip: 'ZIP code',
  city: 'City',
  county: 'County',
  metro: 'Metro area',
  state: 'State',
  national: 'National',
  tract: 'Census tract',
};

/**
 * Get a metric value with automatic fallback to higher geography levels.
 *
 * If data isn't available at the report's geography (e.g., ZIP), tries
 * progressively higher levels (county → metro → state → national).
 *
 * Returns both the value and information about where it came from,
 * so the UI can indicate when using fallback data.
 *
 * @example
 * ```tsx
 * const { value, isFallback, sourceLabel } = getMetricWithGeoFallback(report, 'median_income');
 *
 * return (
 *   <MetricCard value={value}>
 *     {isFallback && <span className="text-xs">({sourceLabel})</span>}
 *   </MetricCard>
 * );
 * ```
 */
export function getMetricWithGeoFallback(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = []
): MetricWithGeoFallback {
  const reportGeo = report.primary_geography_type as GeoLevel;
  const idsToTry = [metricId, ...aliases, ...(METRIC_ALIASES[metricId] || [])];

  // First try current geography data
  for (const id of idsToTry) {
    const currentValue = report.populated_data?.current?.[id];
    if (currentValue !== undefined && currentValue !== null) {
      return {
        value: Number(currentValue),
        sourceGeo: reportGeo,
        sourceLabel: null,
        isFallback: false,
      };
    }
  }

  // Try county benchmark
  for (const id of idsToTry) {
    const countyValue = (report.populated_data?.benchmarks as any)?.county?.[id];
    if (countyValue !== undefined && countyValue !== null) {
      return {
        value: Number(countyValue),
        sourceGeo: 'county',
        sourceLabel: `${GEO_LABELS['county']} average`,
        isFallback: true,
      };
    }
  }

  // Try metro benchmark (similar_metros)
  const similarMetros = report.populated_data?.benchmarks?.similar_metros;
  if (similarMetros) {
    for (const id of idsToTry) {
      for (const metroData of Object.values(similarMetros)) {
        if (metroData?.[id] !== undefined && metroData?.[id] !== null) {
          return {
            value: Number(metroData[id]),
            sourceGeo: 'metro',
            sourceLabel: `${GEO_LABELS['metro']} average`,
            isFallback: true,
          };
        }
      }
    }
  }

  // Try state benchmark
  for (const id of idsToTry) {
    const stateValue = report.populated_data?.benchmarks?.state?.[id];
    if (stateValue !== undefined && stateValue !== null) {
      return {
        value: Number(stateValue),
        sourceGeo: 'state',
        sourceLabel: `${GEO_LABELS['state']} average`,
        isFallback: true,
      };
    }
  }

  // Try national benchmark
  for (const id of idsToTry) {
    const nationalValue = report.populated_data?.benchmarks?.national?.[id];
    if (nationalValue !== undefined && nationalValue !== null) {
      return {
        value: Number(nationalValue),
        sourceGeo: 'national',
        sourceLabel: `${GEO_LABELS['national']} average`,
        isFallback: true,
      };
    }
  }

  // Try historical data - get the most recent value
  const historical = report.populated_data?.historical;
  if (historical) {
    for (const id of idsToTry) {
      const histData = historical[id];
      if (histData && histData.data && histData.data.length > 0) {
        const latestValue = histData.data[histData.data.length - 1].value;
        return {
          value: latestValue,
          sourceGeo: reportGeo,
          sourceLabel: 'Historical',
          isFallback: true,
        };
      }
    }
  }

  return {
    value: null,
    sourceGeo: null,
    sourceLabel: null,
    isFallback: false,
  };
}

/**
 * Get score context data for the homeready or investoredge score
 */
export interface ScoreContext {
  comparison: string;
  dollarImpact: string;
  interpretation: string;
  percentileText: string;
}

export function getScoreContext(
  report: ReportWithTemplate,
  scoreType: 'homeready' | 'investoredge'
): ScoreContext | null {
  if (!report.populated_data?.scores) return null;

  const scoreData = report.populated_data.scores[scoreType] as {
    score?: number;
    context?: {
      comparison?: string;
      dollar_impact?: string;
      interpretation?: string;
      percentile_text?: string;
    };
  } | undefined;

  if (!scoreData || !scoreData.context) return null;

  const ctx = scoreData.context;

  return {
    comparison: ctx.comparison || '',
    dollarImpact: ctx.dollar_impact || '',
    interpretation: ctx.interpretation || '',
    percentileText: ctx.percentile_text || '',
  };
}
