'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnapshotData, fetchTimeSeriesData, formatMetricValue, getMetricFormat } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { BarRaceFrame, BarEntry } from '@/lib/visualizations/d3/HorizontalBarChart';
import { getAllowedStates, matchesAllowedStates, parseStateFromName } from '../constants';
import type { ScatterScope, BarSort, BarCount } from './useGraphsState';

export interface UseBarRaceDataResult {
  raceFrames: BarRaceFrame[];
  formatValue: (v: number) => string;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Geo-aware bar chart race data hook.
 *
 * Peer selection strategy:
 * - Metro: Dynamic top N within scope (state/region/national)
 * - County: Dynamic top N within same state
 * - ZIP: Cascade metro → county → state, rank neighbors
 *
 * Fetches time series for a 3×N wider pool so markets can
 * enter/exit the top N dynamically across frames.
 * User's market is always pinned.
 */
export function useBarRaceData(
  metricId: string,
  geoLevel: GeoLevel,
  primaryMarket: { id: string; name: string; state?: string } | null,
  scope: ScatterScope,
  sort: BarSort,
  count: BarCount,
  enabled: boolean = false,
): UseBarRaceDataResult {
  const { allData, isLoading: snapshotLoading } = useSnapshotData(metricId, geoLevel);

  const formatValue = useCallback(
    (v: number) => formatMetricValue(v, getMetricFormat(metricId)),
    [metricId],
  );

  // Wider pool: 3× the display count for dynamic top N
  const poolSize = count * 3;

  // Identify the wider pool of markets to fetch time series for
  const poolMarkets = useMemo(() => {
    if (snapshotLoading || !allData || Object.keys(allData).length === 0) return [];

    const entries: { id: string; name: string; value: number }[] = [];
    for (const [id, entry] of Object.entries(allData)) {
      if (!entry) continue;
      const val = typeof entry === 'number' ? entry : entry.value;
      const name = (typeof entry === 'object' && entry.name) || id;
      if (val == null || Number.isNaN(val)) continue;
      entries.push({ id, name, value: val });
    }

    // --- Geo-aware pool filtering ---
    let filtered: typeof entries;
    const primaryState = primaryMarket?.state ?? null;

    if (geoLevel === 'zip' || geoLevel === 'county') {
      // ZIP/County: filter to same state(s) as primary market
      if (primaryState) {
        const allowed = getAllowedStates(primaryMarket?.name, primaryState, 'state');
        filtered = allowed
          ? entries.filter((e) => matchesAllowedStates(e.name, allowed))
          : entries;
      } else {
        filtered = entries;
      }
    } else {
      // Metro: respect scope selector (handles multi-state metros)
      const allowed = getAllowedStates(primaryMarket?.name, primaryState ?? undefined, scope);
      filtered = allowed
        ? entries.filter((e) => matchesAllowedStates(e.name, allowed))
        : entries;
    }

    // Sort by value (desc) and take wider pool
    const sorted = [...filtered].sort((a, b) => b.value - a.value);
    const pool = sorted.slice(0, poolSize);

    // Always include primary market
    const primaryId = primaryMarket?.id ?? null;
    if (primaryId && !pool.some((e) => e.id === primaryId)) {
      const primaryEntry = sorted.find((e) => e.id === primaryId);
      if (primaryEntry) pool.push(primaryEntry);
    }

    return pool;
  }, [allData, snapshotLoading, primaryMarket, scope, geoLevel, poolSize]);

  const poolIds = useMemo(() => poolMarkets.map((m) => m.id).join(','), [poolMarkets]);

  // Fetch time series for entire pool, then build dynamic-top-N frames
  const {
    data: raceFrames,
    isLoading: tsLoading,
    error,
  } = useQuery({
    queryKey: ['bar-race', metricId, geoLevel, poolIds],
    queryFn: async () => {
      const results = await Promise.all(
        poolMarkets.map(async (market) => {
          try {
            const res = await fetchTimeSeriesData(metricId, geoLevel, market.id);
            return { market, data: res.data || [] };
          } catch {
            return { market, data: [] };
          }
        }),
      );

      // Build date → market → value map (normalized to YYYY-MM)
      const dateMap = new Map<string, Map<string, { market: typeof poolMarkets[0]; value: number }>>();

      for (const { market, data } of results) {
        for (const point of data) {
          const month = point.date.slice(0, 7);
          if (!dateMap.has(month)) dateMap.set(month, new Map());
          dateMap.get(month)!.set(market.id, { market, value: point.value });
        }
      }

      // Only keep months with at least half the pool reporting
      const minMarkets = Math.max(1, Math.floor(poolMarkets.length / 2));
      const dates = [...dateMap.keys()]
        .filter((d) => dateMap.get(d)!.size >= minMarkets)
        .sort();

      const primaryId = primaryMarket?.id ?? null;

      // Build frames with dynamic top N per frame
      const frames: BarRaceFrame[] = dates.map((date) => {
        const marketData = dateMap.get(date)!;

        // Sort ALL markets in this frame by value
        const allEntries = [...marketData.values()]
          .sort((a, b) => b.value - a.value);

        // Take top N
        const topN = allEntries.slice(0, count);

        // Pin user's market if not in top N
        if (primaryId && !topN.some((e) => e.market.id === primaryId)) {
          const pinned = allEntries.find((e) => e.market.id === primaryId);
          if (pinned) topN.push(pinned);
        }

        const entries: BarEntry[] = topN.map((e) => ({
          id: e.market.id,
          label: e.market.name,
          value: e.value,
          highlighted: e.market.id === primaryId,
        }));

        return { date, entries };
      });

      return frames;
    },
    enabled: enabled && poolMarkets.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    raceFrames: raceFrames ?? [],
    formatValue,
    isLoading: snapshotLoading || tsLoading,
    error: error as Error | null,
  };
}
