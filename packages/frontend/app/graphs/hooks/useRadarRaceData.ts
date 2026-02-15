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
 * then builds min/max-normalized frames (0-100) showing how radar
 * profiles evolve over time.
 *
 * Normalization: for each dimension, collects ALL values across ALL markets
 * and ALL time points, then scales each value to 0-100 based on that
 * dimension's observed min/max range. This produces visible movement
 * whenever a market's raw value changes — unlike percentile ranking
 * against a static snapshot, which barely moves.
 *
 * For `invert` dimensions (lower-is-better), the scale is flipped so
 * higher radar scores still mean "better".
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
              const tsMetric = dim.raceMetricId || dim.metricId || dim.key;
              const res = await fetchTimeSeriesData(tsMetric, geoLevel, market.id);
              const months = new Map<string, number>();
              const points = res.data || [];
              // Detect sparse data: if time series has a mix of zeros and
              // non-zeros, the zeros between non-zero values are likely
              // placeholder/missing (common in quarterly economic data).
              // Strip interleaved zeros so carry-forward can fill them.
              const hasNonZero = points.some((p) => p.value !== 0);
              const allNonZero = points.every((p) => p.value !== 0);
              const isSparse = hasNonZero && !allNonZero;
              for (const pt of points) {
                if (isSparse && pt.value === 0) continue; // skip placeholder zeros
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

      // Collect all months
      const allMonths = new Set<string>();
      for (const [, dimMap] of dataByMarket) {
        for (const [, months] of dimMap) {
          for (const month of months.keys()) allMonths.add(month);
        }
      }

      const sortedMonths = [...allMonths].sort();
      const totalDims = dimensions.length;

      // Record which months have ORIGINAL data per (market, dim) before carry-forward.
      const originalMonths = new Map<string, Set<string>>();
      for (const [marketIdx, dimMap] of dataByMarket) {
        for (const [dimKey, months] of dimMap) {
          originalMonths.set(`${marketIdx}:${dimKey}`, new Set(months.keys()));
        }
      }

      // Carry-forward: some dimensions (census, economic) are annual while
      // others (realtor) are monthly. Fill gaps by repeating the last known
      // value so annual data persists across all months in a year.
      for (const [, dimMap] of dataByMarket) {
        for (const [, months] of dimMap) {
          if (months.size === 0) continue;
          let lastVal: number | undefined;
          for (const month of sortedMonths) {
            const v = months.get(month);
            if (v != null) {
              lastVal = v;
            } else if (lastVal != null) {
              months.set(month, lastVal);
            }
          }
        }
      }

      // Compute per-dimension min/max across ALL markets and ALL months.
      // Used to normalize each dimension to 0-100.
      const dimRanges: { min: number; max: number }[] = dimensions.map((dim) => {
        let min = Infinity;
        let max = -Infinity;
        for (const [, dimMap] of dataByMarket) {
          const months = dimMap.get(dim.key);
          if (!months) continue;
          for (const val of months.values()) {
            if (val < min) min = val;
            if (val > max) max = val;
          }
        }
        return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 100 : max };
      });

      // Build frames with min/max-normalized values.
      const result: RadarRaceFrame[] = [];
      for (const month of sortedMonths) {
        let anyMarketHasData = false;

        const datasets: RadarDataSet[] = markets.map((market, i) => {
          const dimMap = dataByMarket.get(i);
          const values: Record<string, number> = {};

          for (let dimIdx = 0; dimIdx < totalDims; dimIdx++) {
            const dim = dimensions[dimIdx];
            const val = dimMap?.get(dim.key)?.get(month);
            if (val == null) {
              values[dim.key] = 50; // neutral fallback
              continue;
            }
            anyMarketHasData = true;
            const { min, max } = dimRanges[dimIdx];
            const range = max - min;
            // Normalize to 0-100; clamp to [5, 95] to keep polygons visible
            const normalized = range > 0
              ? Math.max(5, Math.min(95, ((val - min) / range) * 100))
              : 50;
            values[dim.key] = dim.invert ? (100 - normalized) : normalized;
          }

          return {
            label: market.name,
            color: datasetColors[i] || '#0891b2',
            values,
          };
        });

        if (anyMarketHasData) {
          result.push({ date: month, datasets });
        }
      }

      // Trim leading frames where data is mostly carried-forward / flat.
      // Start at the first month where at least one market has original
      // (non-carried-forward) data on the majority of dimensions.
      const halfDims = Math.ceil(totalDims / 2);
      let startIdx = 0;
      for (let i = 0; i < result.length; i++) {
        const month = result[i].date;
        let anyMarketReady = false;
        for (let m = 0; m < markets.length; m++) {
          let origCount = 0;
          for (const dim of dimensions) {
            const orig = originalMonths.get(`${m}:${dim.key}`);
            if (orig && orig.has(month)) origCount++;
          }
          if (origCount >= halfDims) {
            anyMarketReady = true;
            break;
          }
        }
        if (anyMarketReady) {
          startIdx = i;
          break;
        }
      }

      return startIdx > 0 ? result.slice(startIdx) : result;
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
