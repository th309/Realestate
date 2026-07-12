/**
 * useAnalyzerDefaults / useUpdateAnalyzerDefaults
 *
 * Per-user assumption defaults for the analyzer form (vacancy, maintenance,
 * capex, etc.). Persisted in `user_preferences.analyzer_defaults`.
 *
 * Cached for 60s — these change rarely and the drawer re-fetches on open.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAnalyzerDefaults,
  updateAnalyzerDefaults,
  type AnalyzerDefaults,
} from "../fetchers/analyzer-defaults";

const STALE_TIME = 60 * 1000;
const QUERY_KEY = ["analyzer-defaults"] as const;

export function useAnalyzerDefaults() {
  return useQuery<AnalyzerDefaults, Error>({
    queryKey: QUERY_KEY,
    queryFn: () => fetchAnalyzerDefaults(),
    staleTime: STALE_TIME,
  });
}

export function useUpdateAnalyzerDefaults() {
  const qc = useQueryClient();
  return useMutation<AnalyzerDefaults, Error, AnalyzerDefaults>({
    mutationFn: (body) => updateAnalyzerDefaults(body),
    onSuccess: (saved) => {
      // Seed the cache with the server's echo immediately so consumers don't
      // compare against stale data while the refetch is in flight.
      qc.setQueryData(QUERY_KEY, saved);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
