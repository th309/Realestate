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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thresholdsKey(strategy) });
    },
  });
}

export function useDeleteThresholds(strategy: Strategy) {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, void>({
    mutationFn: () => deleteThresholds(strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thresholdsKey(strategy) });
    },
  });
}
