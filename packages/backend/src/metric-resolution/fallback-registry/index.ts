/**
 * Fallback Registry — THE single source of truth for metric fallback chains.
 *
 * Every metric in the system has exactly ONE entry in this registry defining:
 *   1. Which data sources to try, in order
 *   2. Whether to inherit from parent geographies
 *
 * The registry is intentionally split into per-domain sub-files (price.ts,
 * rent.ts, market-heat.ts, …) and merged here. Adding a new metric: pick the
 * right sub-file, add the chain there, and the export below picks it up
 * automatically — no edits to consumers needed.
 *
 * Public API: `FALLBACK_REGISTRY`, `getFallbackChain`, and
 * `getAllRegisteredMetricIds`. The characterization test in
 * `__tests__/fallback-registry.spec.ts` snapshots the merged registry so
 * any drift across sub-files surfaces as a reviewable diff.
 *
 * Extracted from:
 *   - market-snapshot.service.ts (REALTOR_COLUMN_MAP, ZILLOW_METRIC_MAP, …)
 *   - reports-data-fetcher.ts (ZHVI->Realtor, ZORI->Census fallbacks)
 *   - scoring-data-fetcher.ts (ZIP median_price->Census, demand/hotness->county)
 *   - inheritance.service.ts (geographic inheritance chain)
 */

import { MetricFallbackChain } from '../metric-resolution.types';
import { priceMetrics } from './price';
import { rentMetrics } from './rent';
import { salesActivityMetrics } from './sales-activity';
import { marketHeatMetrics } from './market-heat';
import { inventoryMetrics } from './inventory';
import { newConstructionMetrics } from './new-construction';
import { affordabilityMetrics } from './affordability';
import { censusMetrics } from './census';
import { economicMetrics } from './economic';
import { calculatedMetrics } from './calculated';
import { briefingAliasMetrics } from './briefing-aliases';
import { employmentMetrics } from './employment';
import { permitsAndQcewMetrics } from './permits-qcew';
import { migrationMetrics } from './migration';
import { redfinDataCenterMetrics } from './redfin-data-center';

export const FALLBACK_REGISTRY: Record<string, MetricFallbackChain> = {
  ...priceMetrics,
  ...rentMetrics,
  ...salesActivityMetrics,
  ...marketHeatMetrics,
  ...inventoryMetrics,
  ...newConstructionMetrics,
  ...affordabilityMetrics,
  ...censusMetrics,
  ...economicMetrics,
  ...calculatedMetrics,
  ...briefingAliasMetrics,
  ...employmentMetrics,
  ...permitsAndQcewMetrics,
  ...migrationMetrics,
  ...redfinDataCenterMetrics,
};

/** Get a fallback chain for a metric, or null if not registered. */
export function getFallbackChain(metricId: string): MetricFallbackChain | null {
  return FALLBACK_REGISTRY[metricId] ?? null;
}

/** Get all registered metric IDs. */
export function getAllRegisteredMetricIds(): string[] {
  return Object.keys(FALLBACK_REGISTRY);
}
