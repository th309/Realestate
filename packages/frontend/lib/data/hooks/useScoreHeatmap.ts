"use client";

/**
 * React Query hook for the Market Momentum Map payload. The full history is
 * ~200KB gzipped and changes monthly — fetch once per session, never refetch
 * on focus/reconnect, and let every widget instance share the cache entry.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchScoreHeatmap,
  type ScoreHeatmapPayload,
} from "../fetchers/score-heatmap";

export interface UseScoreHeatmapResult {
  data: ScoreHeatmapPayload | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useScoreHeatmap(
  options: { enabled?: boolean } = {},
): UseScoreHeatmapResult {
  const { enabled = true } = options;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["score-heatmap", "metro"],
    queryFn: fetchScoreHeatmap,
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    data: data ?? null,
    isLoading,
    // fetchScoreHeatmap resolves null (never throws) on failure, so a settled
    // null IS the error state.
    isError: !isLoading && data === null,
    refetch,
  };
}
