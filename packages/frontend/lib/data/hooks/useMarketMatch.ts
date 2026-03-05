"use client";

/**
 * USE MARKET MATCH HOOK
 *
 * React Query hooks for fetching personalized market match scores.
 * Provides cached access to top matches (for choropleth) and single
 * region matches (for detail panels).
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchTopMarketMatches,
  fetchMarketMatch,
  type MatchScoreResult,
} from "../fetchers/market-match";

const CACHE_TIME = 1000 * 60 * 60 * 2; // 2 hours

// ---------------------------------------------------------------------------
// Top matches (all regions at a geo level — powers choropleth overlay)
// ---------------------------------------------------------------------------

export interface UseTopMarketMatchesOptions {
  geoLevel: string;
  limit?: number;
  enabled?: boolean;
}

export interface UseTopMarketMatchesResult {
  matches: MatchScoreResult[];
  isLoading: boolean;
  error: Error | null;
}

export function useTopMarketMatches({
  geoLevel,
  limit = 200,
  enabled = true,
}: UseTopMarketMatchesOptions): UseTopMarketMatchesResult {
  const { data, isLoading, error } = useQuery<MatchScoreResult[]>({
    queryKey: ["market-match-top", geoLevel, limit],
    queryFn: () => fetchTopMarketMatches(geoLevel, limit),
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
    enabled,
  });

  return {
    matches: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}

// ---------------------------------------------------------------------------
// Single region match (for right detail panel)
// ---------------------------------------------------------------------------

export interface UseMarketMatchOptions {
  geoLevel: string;
  regionId: string | null;
  enabled?: boolean;
}

export interface UseMarketMatchResult {
  match: MatchScoreResult | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMarketMatch({
  geoLevel,
  regionId,
  enabled = true,
}: UseMarketMatchOptions): UseMarketMatchResult {
  const { data, isLoading, error } = useQuery<MatchScoreResult | null>({
    queryKey: ["market-match", geoLevel, regionId],
    queryFn: () => fetchMarketMatch(geoLevel, regionId!),
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
    enabled: enabled && !!regionId,
  });

  return {
    match: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}
