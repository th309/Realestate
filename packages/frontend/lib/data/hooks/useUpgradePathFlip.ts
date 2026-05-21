/**
 * useUpgradePathFlip — server-side F&F upgrade-path computation.
 * Sibling to useUpgradePath (B&H-only).
 */
import { useQuery } from "@tanstack/react-query";
import { type FlipUpgradePathResult } from "@propertyiq/analyzer-core";
import {
  fetchUpgradePathFlip,
  type UpgradePathFlipRequest,
} from "../fetchers/upgrade-path-flip";

export interface UseUpgradePathFlipOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useUpgradePathFlip(
  payload: UpgradePathFlipRequest | null,
  options: UseUpgradePathFlipOptions = {},
) {
  const { enabled = true, staleTime = 60_000 } = options;
  const hasMinimumInput =
    payload != null && payload.input.purchasePrice > 0 && payload.input.arv > 0;
  return useQuery<FlipUpgradePathResult, Error>({
    queryKey: [
      "upgrade-path-flip",
      payload?.targetGrade,
      JSON.stringify(payload).slice(0, 400),
    ],
    queryFn: () => {
      if (!payload) throw new Error("useUpgradePathFlip: payload is null");
      return fetchUpgradePathFlip(payload);
    },
    enabled: enabled && hasMinimumInput,
    staleTime,
  });
}
