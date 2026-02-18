/**
 * BENCHMARK DATA FETCHERS
 *
 * API functions for realtor benchmark comparisons and metric-level benchmarks.
 */

import { fetchAPIRaw } from './base';

// ---------------------------------------------------------------------------
// Types — Realtor benchmarks (local vs state vs national)
// ---------------------------------------------------------------------------

export interface BenchmarkData {
  location: Record<string, number | null>;
  state: Record<string, number | null>;
  national: Record<string, number | null>;
  locationName: string;
  stateName: string | null;
}

// ---------------------------------------------------------------------------
// Types — Metric-level benchmarks (per-metric comparison with parent geo)
// ---------------------------------------------------------------------------

export interface BenchmarkResult {
  metricId: string;
  value: number | null;
  parentGeo: { level: string; id: string; name: string } | null;
  parentValue: number | null;
  diff: number | null;
  direction: 'better' | 'worse' | 'similar' | null;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch benchmark comparison data (local vs state vs national).
 */
export async function fetchBenchmarks(
  geoLevel: string,
  regionId: string,
  stateId?: string,
): Promise<BenchmarkData> {
  const params = new URLSearchParams({ geoLevel, regionId });
  if (stateId) {
    params.append('stateId', stateId);
  }

  const response = await fetchAPIRaw(`/api/realtor/benchmarks?${params}`);
  if (!response.ok) {
    throw new Error(`Benchmark API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch metric-level benchmarks for a geography (comparison with parent geo).
 */
export async function fetchMetricBenchmarks(
  geoLevel: string,
  geoId: string,
  metricIds: string[],
): Promise<BenchmarkResult[]> {
  if (!metricIds.length) return [];

  const metricsParam = metricIds.join(',');
  const response = await fetchAPIRaw(
    `/api/benchmarks/${geoLevel}/${geoId}?metrics=${metricsParam}`,
  );

  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || [];
}
