"use client";

/**
 * USE INSIGHT HOOK
 *
 * React Query hook for fetching AI-generated market insights.
 * Returns parsed content, generation timestamp, and loading/error state.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchInsight, type InsightData } from "../fetchers/insights";

const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 hours

export function useInsight(
  geoLevel: string | null,
  regionId: string | null,
  insightType: string = "market_take",
  archetypeId?: string,
) {
  const { data, isLoading, error } = useQuery<InsightData | null>({
    queryKey: ["insight", geoLevel, regionId, insightType, archetypeId],
    queryFn: () => fetchInsight(geoLevel!, regionId!, insightType, archetypeId),
    enabled: !!geoLevel && !!regionId,
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
  });

  return {
    insight: data?.content ?? null,
    generatedAt: data?.generated_at ?? null,
    loading: isLoading,
    error: error as Error | null,
  };
}
