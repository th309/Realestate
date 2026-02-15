/**
 * Aggregate Time Series Hooks
 *
 * Computes average time series across multiple states:
 * - Census region average (all states in the region)
 * - National average (all 50 states + DC)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchTimeSeriesData } from '@/lib/data/fetchers';
import type { TimeSeriesPoint } from '@/lib/data';
import { getRegionForState, CENSUS_REGIONS, STATE_NAMES } from '../constants/geoRegions';

const ALL_STATES = Object.keys(STATE_NAMES);

/** Average an array of per-state time series into a single series */
function averageSeries(results: TimeSeriesPoint[][]): TimeSeriesPoint[] {
  const byDate = new Map<string, number[]>();
  for (const series of results) {
    for (const pt of series) {
      const arr = byDate.get(pt.date);
      if (arr) arr.push(pt.value);
      else byDate.set(pt.date, [pt.value]);
    }
  }

  const averaged: TimeSeriesPoint[] = [];
  for (const [date, values] of byDate) {
    averaged.push({
      date,
      value: values.reduce((a, b) => a + b, 0) / values.length,
    });
  }
  averaged.sort((a, b) => a.date.localeCompare(b.date));
  return averaged;
}

/** Fetch state-level time series for a list of states and average them */
function fetchAndAverage(
  states: string[],
  metricId: string,
  startDate?: string,
): Promise<TimeSeriesPoint[]> {
  return Promise.all(
    states.map((st) =>
      fetchTimeSeriesData(metricId, 'state', st, { startDate })
        .then((r) => r.data || [])
        .catch(() => [] as TimeSeriesPoint[])
    )
  ).then(averageSeries);
}

// ── Census Region Average ─────────────────────────────────────────────────

interface UseRegionTimeSeriesDataOptions {
  startDate?: string;
  enabled?: boolean;
}

export function useRegionTimeSeriesData(
  metricId: string,
  stateAbbr: string,
  options: UseRegionTimeSeriesDataOptions = {}
) {
  const { startDate, enabled = true } = options;
  const regionSlug = stateAbbr ? getRegionForState(stateAbbr) : null;
  const region = regionSlug ? CENSUS_REGIONS[regionSlug] : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['region-ts', metricId, regionSlug, startDate],
    queryFn: () => fetchAndAverage(region!.states, metricId, startDate),
    enabled: enabled && !!metricId && !!region,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
    regionLabel: region?.label ?? null,
  };
}

// ── National Average ──────────────────────────────────────────────────────

export function useNationalTimeSeriesData(
  metricId: string,
  options: UseRegionTimeSeriesDataOptions = {}
) {
  const { startDate, enabled = true } = options;

  const { data, isLoading, error } = useQuery({
    queryKey: ['national-ts', metricId, startDate],
    queryFn: () => fetchAndAverage(ALL_STATES, metricId, startDate),
    enabled: enabled && !!metricId,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
