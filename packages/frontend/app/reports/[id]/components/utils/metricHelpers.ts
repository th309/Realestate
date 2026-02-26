/**
 * REPORT METRIC HELPERS
 *
 * Barrel re-export + value-access, trend, and score helpers for reports.
 *
 * IMPORTANT (CLAUDE.md Section 5.1): ALL backend metric fallback logic is
 * handled by MetricResolutionService.  See metric-geo-fallback.ts for the
 * provenance-aware fallback function.  This file only handles alias-based
 * value lookups against `populated_data.current`.
 */

import { isMetricAvailableForGeo } from "@/app/map/config/metric-availability";
import type { GeoLevel } from "@/lib/data";
import type { ReportWithTemplate } from "../types";
import { METRIC_ALIASES } from "./metric-aliases";

// ---------------------------------------------------------------------------
// Re-exports (preserve existing import paths for consumers)
// ---------------------------------------------------------------------------

export { METRIC_ALIASES, GEO_HIERARCHY, GEO_LABELS } from "./metric-aliases";

export {
  type MetricProvenance,
  type MetricWithGeoFallback,
  getMetricProvenance,
  getMetricWithGeoFallback,
  getParentGeoLevel,
  isMetricAvailableForReport,
  getBestGeoLevelForMetric,
} from "./metric-geo-fallback";

// ---------------------------------------------------------------------------
// Value access helpers
// ---------------------------------------------------------------------------

/**
 * Get a metric value from the report, checking geo-level availability.
 * Returns null if metric is not available at this geo level.
 */
export function getMetricValue(
  report: ReportWithTemplate,
  metricId: string,
): number | null {
  const geoLevel = report.primary_geography_type as GeoLevel;
  if (!isMetricAvailableForGeo(metricId, geoLevel)) return null;

  const value = report.populated_data?.current?.[metricId];
  if (value === undefined || value === null) return null;
  return typeof value === "number" ? value : null;
}

/**
 * Get a metric value with fallback to benchmarks (for comparison display).
 * NOTE: This does NOT duplicate MetricResolutionService.  It reads
 * already-resolved current data, then falls back to benchmark data
 * which is comparison data, not primary metric resolution.
 */
export function getMetricValueWithFallback(
  report: ReportWithTemplate,
  metricId: string,
): { value: number | null; source: "current" | "state" | "national" | null } {
  const currentValue = report.populated_data?.current?.[metricId];
  if (currentValue !== undefined && currentValue !== null) {
    return { value: Number(currentValue), source: "current" };
  }

  const stateValue = report.populated_data?.benchmarks?.state?.[metricId];
  if (stateValue !== undefined && stateValue !== null) {
    return { value: Number(stateValue), source: "state" };
  }

  const nationalValue = report.populated_data?.benchmarks?.national?.[metricId];
  if (nationalValue !== undefined && nationalValue !== null) {
    return { value: Number(nationalValue), source: "national" };
  }

  return { value: null, source: null };
}

/**
 * Get a metric value, trying aliases if primary key not found.
 * Reads from `populated_data.current` only (backend-resolved data).
 */
export function getMetricWithAliases(
  report: ReportWithTemplate,
  metricId: string,
): number | null {
  const primaryValue = report.populated_data?.current?.[metricId];
  if (primaryValue !== undefined && primaryValue !== null) {
    return Number(primaryValue);
  }

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
 * Convenience wrapper: try primary ID then explicit aliases list.
 */
export function getMetricValueWithAliases(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = [],
): number | null {
  const primaryValue = getMetricWithAliases(report, metricId);
  if (primaryValue !== null) return primaryValue;

  for (const alias of aliases) {
    const aliasValue = getMetricWithAliases(report, alias);
    if (aliasValue !== null) return aliasValue;
  }

  return null;
}

/** Check if any of the required metrics are available */
export function hasAnyMetric(
  report: ReportWithTemplate,
  metricIds: string[],
): boolean {
  return metricIds.some((id) => getMetricWithAliases(report, id) !== null);
}

/** Check if all required metrics are available */
export function hasAllMetrics(
  report: ReportWithTemplate,
  metricIds: string[],
): boolean {
  return metricIds.every((id) => getMetricWithAliases(report, id) !== null);
}

// ---------------------------------------------------------------------------
// Trend helpers
// ---------------------------------------------------------------------------

export type TrendDirection = "up" | "down" | "stable";

export interface MetricTrend {
  direction: TrendDirection;
  changePct: number;
  sparklineData?: number[];
}

/**
 * Get historical trend data for a metric, trying the primary ID and aliases.
 */
export function getMetricTrend(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = [],
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

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

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

export interface ScoreContext {
  comparison: string;
  dollarImpact: string;
  interpretation: string;
  percentileText: string;
}

export function getScoreContext(
  report: ReportWithTemplate,
  scoreType: "homeready" | "investoredge",
): ScoreContext | null {
  if (!report.populated_data?.scores) return null;

  const scoreData = report.populated_data.scores[scoreType] as
    | {
        score?: number;
        context?: {
          comparison?: string;
          dollar_impact?: string;
          interpretation?: string;
          percentile_text?: string;
        };
      }
    | undefined;

  if (!scoreData || !scoreData.context) return null;

  const ctx = scoreData.context;

  return {
    comparison: ctx.comparison || "",
    dollarImpact: ctx.dollar_impact || "",
    interpretation: ctx.interpretation || "",
    percentileText: ctx.percentile_text || "",
  };
}
