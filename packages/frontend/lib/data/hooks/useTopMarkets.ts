/**
 * USE TOP MARKETS HOOK
 *
 * React Query hook for fetching top-ranked markets by score.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchTopMarkets,
  type TopMarketsGeo,
  type TopMarketsScoreType,
  type TopMarketEntry,
} from '../fetchers/scores';
import { useEntitlements } from '@/lib/entitlements';

export interface UseTopMarketsOptions {
  geography: TopMarketsGeo;
  scoreType: TopMarketsScoreType;
  limit?: number;
  enabled?: boolean;
}

export interface UseTopMarketsResult {
  data: TopMarketEntry[];
  isLoading: boolean;
  error: Error | null;
}

export function useTopMarkets(options: UseTopMarketsOptions): UseTopMarketsResult {
  const { geography, scoreType, limit = 10, enabled = true } = options;
  const { isMetricGated } = useEntitlements();
  // Scores are fully gated only if all three score metrics are gated
  const scoresGated = isMetricGated('homeready_score') && isMetricGated('investoredge_score') && isMetricGated('market_health_score');

  const { data, isLoading, error } = useQuery({
    queryKey: ['top-markets', geography, scoreType, limit],
    queryFn: () => fetchTopMarkets(geography, scoreType, limit),
    enabled: enabled && !scoresGated,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60,    // 1 hour
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
