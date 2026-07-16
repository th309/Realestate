"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchScopeSeries,
  type ScopeGeoLevel,
} from "@/lib/data/fetchers/market-explorer";
import type { SeriesByMetric } from "./explorer-math";

export const MAX_MONTHS = 120;

export function useExplorerScopeData(
  geoLevel: ScopeGeoLevel,
  parentLevel?: "state" | "metro" | "county",
  parentId?: string,
  includeNearby?: boolean,
) {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "me-scope",
      geoLevel,
      parentLevel ?? null,
      parentId ?? null,
      !!includeNearby,
    ],
    queryFn: () =>
      fetchScopeSeries(geoLevel, {
        parentLevel,
        parentId,
        months: MAX_MONTHS,
        includeNearby: !!includeNearby,
      }),
    staleTime: 2 * 60 * 60 * 1000, // 2h (CLAUDE.md §5)
    gcTime: 2 * 60 * 60 * 1000,
  });

  return {
    dates: data?.dates ?? [],
    regions: data?.regions ?? [],
    series: (data?.series ?? {}) as SeriesByMetric,
    totalAvailable: data?.totalAvailable,
    isLoading,
    error: (error as Error | undefined) ?? null,
  };
}
