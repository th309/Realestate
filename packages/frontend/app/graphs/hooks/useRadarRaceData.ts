'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTimeSeriesData } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { RadarDataSet, RadarDimension } from '@/lib/visualizations/d3/RadarChart';

export interface RadarRaceFrame {
  date: string;
  datasets: RadarDataSet[];
}

export interface UseRadarRaceDataResult {
  frames: RadarRaceFrame[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches time series for each radar dimension for selected markets,
 * then builds frames showing how radar profiles evolve over time.
 *
 * Data volume is small: dimensions × markets (e.g. 6 × 3 = 18 fetches).
 */
export function useRadarRaceData(
  dimensions: RadarDimension[],
  geoLevel: GeoLevel,
  markets: { id: string; name: string; state?: string }[],
  datasetColors: string[],
  enabled: boolean = false,
): UseRadarRaceDataResult {
  const marketIds = useMemo(() => markets.map((m) => m.id).join(','), [markets]);
  const dimKeys = useMemo(() => dimensions.map((d) => d.key).join(','), [dimensions]);

  const {
    data: frames,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['radar-race', dimKeys, geoLevel, marketIds],
    queryFn: async () => {
      // Fetch time series for each (market, dimension) pair
      const allResults: {
        marketIdx: number;
        dimKey: string;
        months: Map<string, number>;
      }[] = [];

      await Promise.all(
        markets.flatMap((market, marketIdx) =>
          dimensions.map(async (dim) => {
            try {
              const res = await fetchTimeSeriesData(dim.key, geoLevel, market.id);
              const months = new Map<string, number>();
              for (const pt of res.data || []) {
                months.set(pt.date.slice(0, 7), pt.value);
              }
              allResults.push({ marketIdx, dimKey: dim.key, months });
            } catch {
              allResults.push({ marketIdx, dimKey: dim.key, months: new Map() });
            }
          }),
        ),
      );

      // Organize: marketIdx → dimKey → month → value
      const dataByMarket = new Map<number, Map<string, Map<string, number>>>();
      for (const { marketIdx, dimKey, months } of allResults) {
        if (!dataByMarket.has(marketIdx)) dataByMarket.set(marketIdx, new Map());
        dataByMarket.get(marketIdx)!.set(dimKey, months);
      }

      // Collect all months where at least one market has data for all dimensions
      const allMonths = new Set<string>();
      for (const [, dimMap] of dataByMarket) {
        for (const [, months] of dimMap) {
          for (const month of months.keys()) allMonths.add(month);
        }
      }

      const sortedMonths = [...allMonths].sort();

      // Build frames
      const result: RadarRaceFrame[] = [];
      for (const month of sortedMonths) {
        const datasets: RadarDataSet[] = [];

        for (let i = 0; i < markets.length; i++) {
          const dimMap = dataByMarket.get(i);
          if (!dimMap) continue;

          const values: Record<string, number> = {};
          let hasAllDims = true;

          for (const dim of dimensions) {
            const val = dimMap.get(dim.key)?.get(month);
            if (val == null) {
              hasAllDims = false;
              break;
            }
            values[dim.key] = val;
          }

          if (!hasAllDims) continue;

          datasets.push({
            label: markets[i].name,
            color: datasetColors[i] || '#0891b2',
            values,
          });
        }

        // Only include frames where at least one market has full data
        if (datasets.length > 0) {
          result.push({ date: month, datasets });
        }
      }

      return result;
    },
    enabled: enabled && markets.length > 0 && dimensions.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    frames: frames ?? [],
    isLoading,
    error: error as Error | null,
  };
}
