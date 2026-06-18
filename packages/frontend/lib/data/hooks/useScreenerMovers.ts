/**
 * USE SCREENER MOVERS HOOK
 *
 * React Query hook for GET /api/screener/:geo/movers — top score gainers and
 * losers for a window. Same caching posture as useScreener.
 */
"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchScreenerMovers,
  type ScreenerGeoLevel,
  type MoverWindow,
  type ScreenerMoversResult,
} from "../fetchers/screener";

export interface UseScreenerMoversOptions {
  state?: string;
  limit?: number;
  enabled?: boolean;
}

export interface UseScreenerMoversResult {
  data: ScreenerMoversResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useScreenerMovers(
  geoLevel: ScreenerGeoLevel,
  window: MoverWindow,
  options: UseScreenerMoversOptions = {},
): UseScreenerMoversResult {
  const { state, limit = 25, enabled = true } = options;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["screener-movers", geoLevel, window, state ?? null, limit],
    queryFn: () => fetchScreenerMovers(geoLevel, { window, state, limit }),
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
  });

  return { data, isLoading, isFetching, error: error as Error | null };
}
