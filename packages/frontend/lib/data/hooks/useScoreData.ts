/**
 * SCORE DATA HOOK
 *
 * React Query hook for fetching PropertyIQ scores.
 * The API returns all score types (homeready, investoredge, markethealth) in a single response.
 */

import { useQuery } from '@tanstack/react-query';
import type { GeoLevel, ScoreResponse, SingleScoreResult, ScoreType } from '../types';
import { fetchScore, fetchScoreExpanded } from '../fetchers';
import { useEntitlements } from '@/lib/entitlements';
import type { UserTier } from '@/lib/entitlements';

export interface UseScoreDataOptions {
  /** Skip the query */
  enabled?: boolean;
  /** Request expanded details with component breakdown */
  expanded?: boolean;
  /** Request history data (0-6 months) */
  historyMonths?: number;
}

export interface UseScoreDataResult {
  /** Full score response */
  data: ScoreResponse | null;
  /** Individual scores by type */
  homeready: SingleScoreResult | null;
  investoredge: SingleScoreResult | null;
  markethealth: SingleScoreResult | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
  /** Whether scores are gated by entitlements */
  gated: boolean;
  /** Tier required to unlock */
  tierRequired?: UserTier;
}

/**
 * Hook for fetching all PropertyIQ scores for a geography.
 *
 * @param geoLevel - Geography level (metro, county, zip)
 * @param regionId - Specific region identifier
 * @param options - Query options
 *
 * @example
 * const { homeready, investoredge, markethealth, isLoading } = useScoreData(
 *   'county',
 *   '24001'
 * );
 */
export function useScoreData(
  geoLevel: GeoLevel | null,
  regionId: string | null,
  options: UseScoreDataOptions = {}
): UseScoreDataResult {
  const { enabled = true, expanded = false, historyMonths = 0 } = options;
  const { getAccess } = useEntitlements();
  const scoresAccess = getAccess('feature', 'scores');
  const isGated = scoresAccess.level === 'none';

  const queryKey = ['scores', geoLevel, regionId, expanded, historyMonths].filter(
    (v) => v !== null && v !== undefined
  );

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!geoLevel || !regionId) return null;

      // Use expanded fetch if options require it
      if (expanded || historyMonths > 0) {
        return fetchScoreExpanded(geoLevel, regionId, { expanded, historyMonths });
      }
      return fetchScore(geoLevel, regionId);
    },
    // Disable query when gated or when caller disables it
    enabled: enabled && !isGated && !!geoLevel && !!regionId,
    staleTime: 5 * 60 * 1000, // 5 minutes - scores can change more frequently
    gcTime: 30 * 60 * 1000,
  });

  if (isGated) {
    return {
      data: null,
      homeready: null,
      investoredge: null,
      markethealth: null,
      isLoading: false,
      error: null,
      refetch: () => {},
      gated: true,
      tierRequired: scoresAccess.tierRequired ?? undefined,
    };
  }

  return {
    data: data ?? null,
    homeready: data?.scores?.homeready ?? null,
    investoredge: data?.scores?.investoredge ?? null,
    markethealth: data?.scores?.markethealth ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
    gated: false,
  };
}

/**
 * Hook for fetching a single score type for a geography.
 *
 * @param scoreType - Which score to extract (homeready, investoredge, markethealth)
 * @param geoLevel - Geography level
 * @param regionId - Specific region identifier
 * @param options - Query options
 */
export function useSingleScore(
  scoreType: ScoreType,
  geoLevel: GeoLevel | null,
  regionId: string | null,
  options: UseScoreDataOptions = {}
): {
  score: SingleScoreResult | null;
  value: number | null;
  grade: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useScoreData(geoLevel, regionId, options);

  let score: SingleScoreResult | null = null;
  if (data?.scores) {
    score = data.scores[scoreType] ?? null;
  }

  return {
    score,
    value: score?.score ?? null,
    grade: score?.grade ?? null,
    isLoading,
    error,
  };
}
