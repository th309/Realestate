/**
 * useUpgradePath — server-side upgrade-path computation.
 *
 * Calls /api/analyzer/upgrade-path. Like useGradeDeal, the request is fully
 * idempotent over its payload, so we use `useQuery` (not `useMutation`) and
 * let React Query's cache naturally invalidate when any field changes.
 *
 * Disabled when `payload` is null OR when the deal lacks the bare minimum
 * for grading (price + rent) — keeps us from firing requests against
 * half-typed forms.
 */

import { useQuery } from "@tanstack/react-query";
import { type UpgradePathResult } from "@propertyiq/analyzer-core";
import {
  fetchUpgradePath,
  type UpgradePathRequest,
} from "../fetchers/upgrade-path";

export interface UseUpgradePathOptions {
  enabled?: boolean;
  /** Stale time in ms. Defaults to 60s — matches useGradeDeal. */
  staleTime?: number;
}

export function useUpgradePath(
  payload: UpgradePathRequest | null,
  options: UseUpgradePathOptions = {},
) {
  const { enabled = true, staleTime = 60_000 } = options;
  const hasMinimumInput =
    payload != null &&
    payload.input.price > 0 &&
    (payload.input.rentMonthly ?? 0) > 0;
  return useQuery<UpgradePathResult, Error>({
    queryKey: [
      "upgrade-path",
      payload?.strategy,
      payload?.targetGrade,
      // Hash the payload — stable enough for caching, fine-grained enough
      // to refetch when any input/threshold changes.
      JSON.stringify(payload).slice(0, 400),
    ],
    queryFn: () => {
      if (!payload) throw new Error("useUpgradePath: payload is null");
      return fetchUpgradePath(payload);
    },
    enabled: enabled && hasMinimumInput,
    staleTime,
  });
}
