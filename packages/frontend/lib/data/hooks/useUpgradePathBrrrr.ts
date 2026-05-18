/**
 * useUpgradePathBrrrr — server-side BRRRR upgrade-path computation.
 * Sibling to useUpgradePath (B&H) and useUpgradePathFlip (F&F).
 */
import { useQuery } from "@tanstack/react-query";
import { type BrrrrUpgradePathResult } from "@propertyiq/analyzer-core";
import {
  fetchUpgradePathBrrrr,
  type UpgradePathBrrrrRequest,
} from "../fetchers/upgrade-path-brrrr";

export interface UseUpgradePathBrrrrOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useUpgradePathBrrrr(
  payload: UpgradePathBrrrrRequest | null,
  options: UseUpgradePathBrrrrOptions = {},
) {
  const { enabled = true, staleTime = 60_000 } = options;
  const hasMinimumInput =
    payload != null &&
    payload.input.purchasePrice > 0 &&
    payload.input.arv > 0 &&
    payload.input.monthlyRent > 0;
  return useQuery<BrrrrUpgradePathResult, Error>({
    queryKey: [
      "upgrade-path-brrrr",
      payload?.targetGrade,
      JSON.stringify(payload).slice(0, 400),
    ],
    queryFn: () => {
      if (!payload) throw new Error("useUpgradePathBrrrr: payload is null");
      return fetchUpgradePathBrrrr(payload);
    },
    enabled: enabled && hasMinimumInput,
    staleTime,
  });
}
