/**
 * useGradeDeal — server-side deal grading (analyzer-core engine).
 *
 * Uses `useQuery` (not `useMutation`) because grading is idempotent and
 * depends entirely on the payload — React Query's cache naturally
 * invalidates when the input changes. Mirrors `useAiSectionAnnotation`.
 *
 * `enabled` gates on the bare minimum input (price + monthly rent) so we
 * don't fire requests against a half-typed form. Consumers can pass
 * `enabled: false` to defer until the user clicks "Grade".
 */

import { useQuery } from "@tanstack/react-query";
import { type DealGradingResult } from "@propertyiq/analyzer-core";
import { fetchGradeDeal, type GradeDealRequest } from "../fetchers/grading";

export interface UseGradeDealOptions {
  enabled?: boolean;
  /**
   * Stale time in ms. Defaults to 60s — grading is cheap server-side but
   * we don't want a flood of requests during rapid input edits.
   */
  staleTime?: number;
}

export function useGradeDeal(
  payload: GradeDealRequest | null,
  options: UseGradeDealOptions = {},
) {
  const { enabled = true, staleTime = 60_000 } = options;
  const hasMinimumInput =
    payload != null &&
    payload.input.price > 0 &&
    (payload.input.rentMonthly ?? 0) > 0;
  return useQuery<DealGradingResult, Error>({
    queryKey: [
      "grade-deal",
      payload?.strategy,
      // Hash the payload shape — keep the key stable but resampling-sensitive.
      JSON.stringify(payload).slice(0, 400),
    ],
    queryFn: () => {
      if (!payload) throw new Error("useGradeDeal: payload is null");
      return fetchGradeDeal(payload);
    },
    enabled: enabled && hasMinimumInput,
    staleTime,
  });
}
