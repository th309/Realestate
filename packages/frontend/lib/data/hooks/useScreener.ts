/**
 * USE SCREENER HOOK
 *
 * React Query hook for the market screener endpoint.
 * Uses placeholderData: keepPreviousData so the table stays populated
 * while filters or page changes are in flight — no flash to empty state.
 */

"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchScreener,
  type ScreenerGeoLevel,
  type ScreenerQuery,
  type ScreenerResult,
} from "../fetchers/screener";

export interface UseScreenerOptions {
  enabled?: boolean;
}

export interface UseScreenerResult {
  data: ScreenerResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useScreener(
  geoLevel: ScreenerGeoLevel,
  query: ScreenerQuery = {},
  options: UseScreenerOptions = {},
): UseScreenerResult {
  const { enabled = true } = options;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["screener", geoLevel, query],
    queryFn: () => fetchScreener(geoLevel, query),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes — screener data is relatively stable
    gcTime: 1000 * 60 * 30, // 30 minutes
    placeholderData: keepPreviousData,
  });

  return {
    data,
    isLoading,
    isFetching,
    error: error as Error | null,
  };
}
