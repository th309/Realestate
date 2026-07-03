/**
 * Reports Data Fetcher — shared types
 *
 * Type definitions for the report data-fetching pipeline. Extracted from
 * reports-data-fetcher.ts for file-size compliance. Re-exported from the
 * main module for backward compatibility.
 */

import type { MarketMetrics } from './reports-market-comparison';

/** Provenance metadata for a single resolved metric value */
export interface MetricProvenance {
  source: string;
  sourceGeoId: string | null;
  sourceGeoLevel: string | null;
  isInherited: boolean;
  isFallback: boolean;
}

/** Return type for fetchMarketMetrics — values plus provenance */
export interface MarketMetricsWithProvenance {
  metrics: MarketMetrics;
  provenance: Record<string, MetricProvenance>;
}

/** Historical data for a single metric */
export interface HistoricalMetricData {
  data: Array<{ date: string; value: number }>;
  trend: 'up' | 'down' | 'stable';
  change_pct: number;
}

/** Historical data collection for all metrics */
export interface HistoricalData {
  [metricId: string]: HistoricalMetricData;
}
