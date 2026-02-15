'use client';

import { useMemo, useCallback } from 'react';
import { useSnapshotData, formatMetricValue, getMetricFormat, getMetricTitle } from '@/lib/data';
import type { GeoLevel, SnapshotData } from '@/lib/data';
import type { BarEntry } from '@/lib/visualizations/d3/HorizontalBarChart';
import { getAllowedStates, matchesAllowedStates, getScopeBenchmarkLabel } from '../constants';

// Re-export shared types from useGraphsState for convenience
export type { ScatterScope, BarSort, BarCount } from './useGraphsState';
import type { ScatterScope, BarSort, BarCount } from './useGraphsState';

export interface UseBarRankingDataResult {
  data: BarEntry[];
  benchmarkValue: number | null;
  benchmarkLabel: string;
  metricTitle: string;
  formatValue: (v: number) => string;
  isLoading: boolean;
  error: Error | null;
}


/** Compute the median of a sorted (ascending) array of numbers */
function median(sorted: number[]): number | null {
  const len = sorted.length;
  if (len === 0) return null;
  const mid = Math.floor(len / 2);
  return len % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Hook that provides ranked bar-chart data for a single metric.
 *
 * Fetches all snapshot entries for the given metric and geoLevel, filters
 * by scope (state / region / national), sorts, computes a median benchmark,
 * and slices to the requested count -- always ensuring the user's primary
 * market is visible.
 */
export function useBarRankingData(
  metricId: string,
  geoLevel: GeoLevel,
  primaryMarket: { id: string; name: string; state?: string } | null,
  scope: ScatterScope,
  sort: BarSort,
  count: BarCount,
): UseBarRankingDataResult {
  // 1. Fetch ALL snapshot data for this metric + geoLevel (no regionId)
  const { allData, isLoading, error } = useSnapshotData(metricId, geoLevel);

  // Stable format function derived from metric config
  const formatValue = useCallback(
    (v: number) => formatMetricValue(v, getMetricFormat(metricId)),
    [metricId],
  );

  const metricTitle = getMetricTitle(metricId);

  // 2-9. Transform, filter, sort, slice, and map to BarEntry[]
  const { data, benchmarkValue, benchmarkLabel } = useMemo(() => {
    if (isLoading || !allData || Object.keys(allData).length === 0) {
      return { data: [] as BarEntry[], benchmarkValue: null, benchmarkLabel: '' };
    }

    // --- 2. Convert record to array of { id, name, value } ---
    const entries: { id: string; name: string; value: number }[] = [];

    for (const [id, entry] of Object.entries(allData)) {
      if (!entry) continue;
      const val = typeof entry === 'number' ? entry : entry.value;
      const name =
        (typeof entry === 'object' && entry.name) || id;

      // 4. Filter out null / undefined / NaN values
      if (val == null || Number.isNaN(val)) continue;

      entries.push({ id, name, value: val });
    }

    // --- 3. Filter by scope ---
    // For multi-state metros (e.g., DC-VA-MD-WV), state scope includes
    // all states the metro spans so it can be meaningfully compared.
    const primaryState = primaryMarket?.state ?? null;
    const allowedStates = getAllowedStates(primaryMarket?.name, primaryState ?? undefined, scope);

    const filtered = allowedStates
      ? entries.filter((e) => matchesAllowedStates(e.name, allowedStates!))
      : entries;

    // --- 5. Sort by value ---
    const sorted = [...filtered].sort((a, b) =>
      sort === 'desc' ? b.value - a.value : a.value - b.value,
    );

    // --- 6. Calculate benchmark: median of ALL filtered entries (before slicing) ---
    const valuesAsc = filtered.map((e) => e.value).sort((a, b) => a - b);
    const medianVal = median(valuesAsc);

    // --- 7. Slice to top N ---
    const sliced = sorted.slice(0, count);

    // --- 8. If primary market is not in the sliced set, append it ---
    const primaryId = primaryMarket?.id ?? null;
    const primaryInSlice = primaryId !== null && sliced.some((e) => e.id === primaryId);

    if (primaryId && !primaryInSlice) {
      const primaryEntry = sorted.find((e) => e.id === primaryId);
      if (primaryEntry) {
        sliced.push(primaryEntry);
      }
    }

    // --- 9. Map to BarEntry[] ---
    const barData: BarEntry[] = sliced.map((e) => ({
      id: e.id,
      label: e.name,
      value: e.value,
      highlighted: e.id === primaryId,
    }));

    // --- 11. Benchmark label based on scope ---
    const label = getScopeBenchmarkLabel(primaryMarket?.name, primaryState ?? undefined, scope);

    return { data: barData, benchmarkValue: medianVal, benchmarkLabel: label };
  }, [allData, isLoading, primaryMarket, scope, sort, count]);

  return {
    data,
    benchmarkValue,
    benchmarkLabel,
    metricTitle,
    formatValue,
    isLoading,
    error,
  };
}
