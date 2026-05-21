/**
 * useGradeBrrrrDeal — server-side BRRRR deal grading. Separate from
 * useGradeDeal and useGradeFlipDeal so the B&H + F&F hook surfaces stay at
 * their committed shapes.
 */
import { useQuery } from "@tanstack/react-query";
import { type DealGradingResult } from "@propertyiq/analyzer-core";
import {
  fetchGradeBrrrrDeal,
  type BrrrrGradeRequest,
} from "../fetchers/grade-brrrr";

export interface UseGradeBrrrrDealOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useGradeBrrrrDeal(
  payload: BrrrrGradeRequest | null,
  options: UseGradeBrrrrDealOptions = {},
) {
  const { enabled = true, staleTime = 60_000 } = options;
  const hasMinimumInput =
    payload != null &&
    payload.input.purchasePrice > 0 &&
    payload.input.arv > 0 &&
    payload.input.monthlyRent > 0;
  return useQuery<DealGradingResult, Error>({
    queryKey: ["grade-brrrr-deal", JSON.stringify(payload).slice(0, 400)],
    queryFn: () => {
      if (!payload) throw new Error("useGradeBrrrrDeal: payload is null");
      return fetchGradeBrrrrDeal(payload);
    },
    enabled: enabled && hasMinimumInput,
    staleTime,
  });
}
