'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnapshotData, fetchTimeSeriesData } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { ScatterDataPoint } from '@/lib/visualizations/d3/ScatterPlot';
import { getAllowedStates, matchesAllowedStates } from '../constants';
import type { ScatterScope } from './useGraphsState';

export interface ScatterRaceFrame {
  date: string;
  points: ScatterDataPoint[];
}

export interface UseScatterRaceDataResult {
  frames: ScatterRaceFrame[];
  isLoading: boolean;
  error: Error | null;
}

const POOL_SIZE = 75; // 3× a reasonable display count

/**
 * Fetches time series for X and Y metrics for all markets in scope,
 * then builds frames for Gapminder-style scatter race animation.
 *
 * Each frame positions markets at their (x, y) values for that month.
 */
export function useScatterRaceData(
  xMetricId: string,
  yMetricId: string,
  geoLevel: GeoLevel,
  primaryMarket: { id: string; name: string; state?: string } | null,
  scope: ScatterScope,
  enabled: boolean = false,
): UseScatterRaceDataResult {
  // Get snapshot for X metric to identify markets in scope
  const { allData, isLoading: snapshotLoading } = useSnapshotData(xMetricId, geoLevel);

  // Identify markets in scope
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

    // Filter by scope (handles multi-state metros like DC-VA-MD-WV)
    const primaryState = primaryMarket?.state ?? null;
    const allowedStates = getAllowedStates(primaryMarket?.name, primaryState ?? undefined, scope);

    const filtered = allowedStates
      ? entries.filter((e) => matchesAllowedStates(e.name, allowedStates!))
      : entries;

    // For narrow scopes (state/region) include all markets; for national limit pool
    // to avoid hundreds of parallel API calls.
    const sorted = [...filtered].sort((a, b) => b.value - a.value);
    const pool = scope === 'national' ? sorted.slice(0, POOL_SIZE) : sorted;

    // Always include primary market
    const primaryId = primaryMarket?.id ?? null;
    if (primaryId && !pool.some((e) => e.id === primaryId)) {
      const primaryEntry = sorted.find((e) => e.id === primaryId);
      if (primaryEntry) pool.push(primaryEntry);
    }

    return pool;
  }, [allData, snapshotLoading, primaryMarket, scope]);

  const poolIds = useMemo(() => poolMarkets.map((m) => m.id).join(','), [poolMarkets]);

  // Fetch X and Y time series for all pool markets
  const {
    data: frames,
    isLoading: tsLoading,
    error,
  } = useQuery({
    queryKey: ['scatter-race', xMetricId, yMetricId, geoLevel, poolIds],
    queryFn: async () => {
      // Fetch both metrics for all markets in parallel
      const [xResults, yResults] = await Promise.all([
        Promise.all(
          poolMarkets.map(async (market) => {
            try {
              const res = await fetchTimeSeriesData(xMetricId, geoLevel, market.id);
              return { id: market.id, data: res.data || [] };
            } catch {
              return { id: market.id, data: [] };
            }
          }),
        ),
        Promise.all(
          poolMarkets.map(async (market) => {
            try {
              const res = await fetchTimeSeriesData(yMetricId, geoLevel, market.id);
              return { id: market.id, data: res.data || [] };
            } catch {
              return { id: market.id, data: [] };
            }
          }),
        ),
      ]);

      // Build per-market lookup: id → { month → value }
      const xByMarket = new Map<string, Map<string, number>>();
      const yByMarket = new Map<string, Map<string, number>>();

      for (const { id, data } of xResults) {
        const monthMap = new Map<string, number>();
        for (const pt of data) monthMap.set(pt.date.slice(0, 7), pt.value);
        xByMarket.set(id, monthMap);
      }

      for (const { id, data } of yResults) {
        const monthMap = new Map<string, number>();
        for (const pt of data) monthMap.set(pt.date.slice(0, 7), pt.value);
        yByMarket.set(id, monthMap);
      }

      // Collect all months where at least some markets have both X and Y
      const allMonths = new Set<string>();
      for (const [id, xMap] of xByMarket) {
        const yMap = yByMarket.get(id);
        if (!yMap) continue;
        for (const month of xMap.keys()) {
          if (yMap.has(month)) allMonths.add(month);
        }
      }

      const months = [...allMonths].sort();
      const primaryId = primaryMarket?.id ?? null;

      // Build frames
      const result: ScatterRaceFrame[] = months.map((month) => {
        const points: ScatterDataPoint[] = [];

        for (const market of poolMarkets) {
          const xVal = xByMarket.get(market.id)?.get(month);
          const yVal = yByMarket.get(market.id)?.get(month);
          if (xVal == null || yVal == null) continue;

          points.push({
            id: market.id,
            label: market.name,
            x: xVal,
            y: yVal,
            size: market.id === primaryId ? 14 : 8,
          });
        }

        return { date: month, points };
      });

      // Filter out empty frames
      return result.filter((f) => f.points.length >= 3);
    },
    enabled: enabled && poolMarkets.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    frames: frames ?? [],
    isLoading: snapshotLoading || tsLoading,
    error: error as Error | null,
  };
}
