/**
 * useThresholds / useUpdateThresholds / useDeleteThresholds
 *
 * Per-strategy thresholds. Query keyed by ["thresholds", strategy] so the
 * three strategies (BUY_AND_HOLD, FIX_AND_FLIP, BRRRR) don't collide in cache.
 *
 * Mutations invalidate the matching strategy key so the drawer re-renders
 * with server-truth after Save or Reset.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Strategy, UserThresholds } from "@propertyiq/analyzer-core";
import {
  deleteThresholds,
  fetchThresholds,
  updateThresholds,
} from "../fetchers/thresholds";

const STALE_TIME = 30 * 1000;

function thresholdsKey(strategy: Strategy) {
  return ["thresholds", strategy] as const;
}

/**
 * Grading is computed server-side against the caller's SAVED thresholds
 * (resolution: override → saved → default), so any grade/upgrade-path result
 * in the cache goes stale the moment thresholds change. Invalidate them all
 * after Save / Reset so the open analysis regrades immediately.
 */
const GRADING_DEPENDENT_KEYS = [
  "grade-deal",
  "grade-flip-deal",
  "grade-brrrr-deal",
  "upgrade-path",
  "upgrade-path-flip",
  "upgrade-path-brrrr",
] as const;

function invalidateGradingQueries(qc: ReturnType<typeof useQueryClient>) {
  for (const key of GRADING_DEPENDENT_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useThresholds(strategy: Strategy) {
  return useQuery<UserThresholds, Error>({
    queryKey: thresholdsKey(strategy),
    queryFn: () => fetchThresholds(strategy),
    staleTime: STALE_TIME,
  });
}

export function useUpdateThresholds(strategy: Strategy) {
  const qc = useQueryClient();
  return useMutation<UserThresholds, Error, UserThresholds>({
    mutationFn: (body) => updateThresholds(strategy, body),
    onSuccess: (saved) => {
      // Seed the cache with the server's echo immediately — consumers (e.g.
      // the drawer's dirty check) must not compare against stale data while
      // the invalidation refetch is in flight.
      qc.setQueryData(thresholdsKey(strategy), saved);
      qc.invalidateQueries({ queryKey: thresholdsKey(strategy) });
      invalidateGradingQueries(qc);
    },
  });
}

export function useDeleteThresholds(strategy: Strategy) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, void>({
    mutationFn: () => deleteThresholds(strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thresholdsKey(strategy) });
      invalidateGradingQueries(qc);
    },
  });
}
