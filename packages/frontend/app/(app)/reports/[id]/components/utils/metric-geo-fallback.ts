/**
 * METRIC GEO FALLBACK & PROVENANCE
 *
 * Geography-level helpers for report metric access:
 * - Reading backend provenance metadata (MetricResolutionService)
 * - Geo-level availability checks
 * - Fallback to benchmark data when primary value is missing
 *
 * IMPORTANT (CLAUDE.md Section 5.1): ALL backend metric fallback logic is
 * handled by MetricResolutionService.  This file does NOT duplicate that
 * chain.  It reads the already-resolved values from `populated_data.current`
 * and enriches them with provenance from `populated_data.metric_provenance`.
 */

import { isMetricAvailableForGeo } from "@/app/map/config/metric-availability";
import type { GeoLevel } from "@/lib/data";
import type { ReportWithTemplate } from "../types";
import { METRIC_ALIASES, GEO_HIERARCHY, GEO_LABELS } from "./metric-aliases";

// ---------------------------------------------------------------------------
// Provenance types & access
// ---------------------------------------------------------------------------

/**
 * Provenance metadata attached by the backend's MetricResolutionService.
 * Stored on `populated_data.metric_provenance[fieldName]`.
 */
export interface MetricProvenance {
  source: string;
  sourceGeoId: string | null;
  sourceGeoLevel: string | null;
  isInherited: boolean;
  isFallback: boolean;
}

/**
 * Read backend-provided provenance for a metric field.
 * The provenance map is keyed by the backend field name (e.g. 'zhvi',
 * 'unemployment_rate'), which may differ from the display metric ID.
 */
export function getMetricProvenance(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = [],
): MetricProvenance | null {
  const provenance = (report.populated_data as any)?.metric_provenance as
    | Record<string, MetricProvenance>
    | undefined;
  if (!provenance) return null;

  const idsToTry = [metricId, ...aliases, ...(METRIC_ALIASES[metricId] || [])];
  for (const id of idsToTry) {
    if (provenance[id]) return provenance[id];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Geography availability helpers
// ---------------------------------------------------------------------------

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
  report: ReportWithTemplate,
): boolean {
  const geoLevel = report.primary_geography_type as GeoLevel;
  return isMetricAvailableForGeo(metricId, geoLevel);
}

/**
 * Get the best available geo level for a metric.
 * Returns the report's geo level if available, or the nearest parent level.
 */
export function getBestGeoLevelForMetric(
  metricId: string,
  reportGeoLevel: GeoLevel,
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

// ---------------------------------------------------------------------------
// Geo fallback result type
// ---------------------------------------------------------------------------

/**
 * Result type for metric with geo fallback
 */
export interface MetricWithGeoFallback {
  value: number | null;
  /** The geography level the data came from */
  sourceGeo: GeoLevel | null;
  /** Human-readable label for the source (e.g., "State benchmark") */
  sourceLabel: string | null;
  /** Whether this is from a fallback geography (not the report's primary geo) */
  isFallback: boolean;
}

// ---------------------------------------------------------------------------
// Main fallback function
// ---------------------------------------------------------------------------

/**
 * Get a metric value with provenance metadata.
 *
 * The backend's MetricResolutionService already handles all metric fallback
 * and geography inheritance logic and stores resolved values in
 * `populated_data.current`.  This function reads those values and enriches
 * them with provenance from `populated_data.metric_provenance`.
 *
 * It does NOT re-implement the backend fallback chain.  If the value is
 * missing from `current`, benchmark data is only used as a last-resort
 * display hint (clearly labeled as a benchmark, not a resolved value).
 */
export function getMetricWithGeoFallback(
  report: ReportWithTemplate,
  metricId: string,
  aliases: string[] = [],
): MetricWithGeoFallback {
  const reportGeo = report.primary_geography_type as GeoLevel;
  const idsToTry = [metricId, ...aliases, ...(METRIC_ALIASES[metricId] || [])];

  // 1. Try current geography data (already resolved by MetricResolutionService)
  for (const id of idsToTry) {
    const currentValue = report.populated_data?.current?.[id];
    if (currentValue !== undefined && currentValue !== null) {
      // Check backend provenance to see if this was inherited or a fallback
      const prov = getMetricProvenance(report, id);
      if (prov?.isInherited && prov.sourceGeoLevel) {
        const inheritedGeo = prov.sourceGeoLevel as GeoLevel;
        return {
          value: Number(currentValue),
          sourceGeo: inheritedGeo,
          sourceLabel: `${GEO_LABELS[inheritedGeo] ?? prov.sourceGeoLevel} (inherited)`,
          isFallback: true,
        };
      }
      return {
        value: Number(currentValue),
        sourceGeo: reportGeo,
        sourceLabel: prov?.isFallback ? `${prov.source} (fallback)` : null,
        isFallback: prov?.isFallback ?? false,
      };
    }
  }

  // 2. If the backend did not resolve this metric, fall back to benchmarks
  //    for display purposes only.
  const benchmarkResult = findBenchmarkValue(report, idsToTry);
  if (benchmarkResult) return benchmarkResult;

  return {
    value: null,
    sourceGeo: null,
    sourceLabel: null,
    isFallback: false,
  };
}

/**
 * Search benchmark data for a display-only fallback value.
 * Returns null if nothing is found.
 */
function findBenchmarkValue(
  report: ReportWithTemplate,
  idsToTry: string[],
): MetricWithGeoFallback | null {
  // State benchmark
  for (const id of idsToTry) {
    const stateValue = report.populated_data?.benchmarks?.state?.[id];
    if (stateValue !== undefined && stateValue !== null) {
      return {
        value: Number(stateValue),
        sourceGeo: "state",
        sourceLabel: `${GEO_LABELS["state"]} benchmark`,
        isFallback: true,
      };
    }
  }

  // National benchmark
  for (const id of idsToTry) {
    const nationalValue = report.populated_data?.benchmarks?.national?.[id];
    if (nationalValue !== undefined && nationalValue !== null) {
      return {
        value: Number(nationalValue),
        sourceGeo: "national",
        sourceLabel: `${GEO_LABELS["national"]} benchmark`,
        isFallback: true,
      };
    }
  }

  return null;
}
