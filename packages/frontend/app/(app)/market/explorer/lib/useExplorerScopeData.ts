"use client";

import { useQueries } from "@tanstack/react-query";
import {
  fetchScopeSeries,
  type ScopeSeriesResponse,
  type ScopeRegion,
  type ScopeGeoLevel,
} from "@/lib/data/fetchers/market-explorer";
import { FETCHED_METRICS } from "./explorer-config";
import type { SeriesByMetric } from "./explorer-math";

export const MAX_MONTHS = 120;

/** Merge per-metric responses onto one canonical (union) monthly axis. */
export function mergeScopeResponses(
  entries: { metric: string; resp?: ScopeSeriesResponse }[],
): { dates: string[]; regions: ScopeRegion[]; series: SeriesByMetric } {
  const dateSet = new Set<string>();
  let regions: ScopeRegion[] = [];
  for (const { resp } of entries) {
    if (!resp) continue;
    resp.dates.forEach((d) => dateSet.add(d));
    if (resp.regions.length && !regions.length) regions = resp.regions;
  }
  const dates = [...dateSet].sort();
  const pos = new Map(dates.map((d, i) => [d, i]));

  const series: SeriesByMetric = {};
  for (const { metric, resp } of entries) {
    if (!resp) continue;
    const realigned: Record<string, (number | null)[]> = {};
    for (const [regionId, arr] of Object.entries(resp.series)) {
      const out: (number | null)[] = new Array(dates.length).fill(null);
      resp.dates.forEach((d, j) => {
        const i = pos.get(d);
        if (i !== undefined) out[i] = arr[j];
      });
      realigned[regionId] = out;
    }
    series[metric] = realigned;
  }
  return { dates, regions, series };
}

export function useExplorerScopeData(
  geoLevel: ScopeGeoLevel,
  parentLevel?: "state" | "metro" | "county",
  parentId?: string,
  includeNearby?: boolean,
) {
  const results = useQueries({
    queries: FETCHED_METRICS.map((metric) => ({
      queryKey: [
        "me-scope",
        geoLevel,
        parentLevel ?? null,
        parentId ?? null,
        metric,
        !!includeNearby,
      ],
      queryFn: () =>
        fetchScopeSeries(geoLevel, {
          parentLevel,
          parentId,
          metric,
          months: MAX_MONTHS,
          includeNearby,
        }),
      staleTime: 2 * 60 * 60 * 1000, // 2h (CLAUDE.md §5)
      gcTime: 2 * 60 * 60 * 1000,
    })),
  });

  const merged = mergeScopeResponses(
    FETCHED_METRICS.map((metric, i) => ({ metric, resp: results[i].data })),
  );

  return {
    ...merged,
    isLoading: results.some((r) => r.isLoading),
    error: (results.find((r) => r.error)?.error as Error | undefined) ?? null,
  };
}
