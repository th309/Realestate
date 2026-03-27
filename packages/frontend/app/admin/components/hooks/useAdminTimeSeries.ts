"use client";

/**
 * USE ADMIN TIME SERIES HOOK
 *
 * Generic hook for fetching any time-series data from the admin metrics endpoints.
 * Params with undefined values are automatically stripped before the request.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchAPIWithParams } from "@/lib/data";

export interface UseAdminTimeSeriesOptions {
  enabled?: boolean;
  refreshTrigger?: number;
}

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

export function useAdminTimeSeries<T>(
  endpoint: string,
  params?: Record<string, string | undefined>,
  options: UseAdminTimeSeriesOptions = {},
) {
  const { enabled = true, refreshTrigger = 0 } = options;

  // Strip undefined values so they don't appear as empty query params
  const cleanedParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined),
      )
    : undefined;

  const { data, isLoading, error, refetch } = useQuery<T>({
    queryKey: ["admin", "time-series", endpoint, cleanedParams, refreshTrigger],
    queryFn: () =>
      fetchAPIWithParams<T>(`/api/admin/metrics/${endpoint}`, cleanedParams),
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 5,
    enabled,
  });

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
