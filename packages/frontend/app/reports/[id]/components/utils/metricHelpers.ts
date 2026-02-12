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
