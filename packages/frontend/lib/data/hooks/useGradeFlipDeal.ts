/**
 * useGradeFlipDeal — server-side F&F deal grading. Separate from useGradeDeal
 * so the B&H hook stays at its committed shape.
 */
import { useQuery } from "@tanstack/react-query";
import { type DealGradingResult } from "@propertyiq/analyzer-core";
import {
  fetchGradeFlipDeal,
  type FixAndFlipGradeRequest,
} from "../fetchers/grade-flip";

export interface UseGradeFlipDealOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useGradeFlipDeal(
  payload: FixAndFlipGradeRequest | null,
  options: UseGradeFlipDealOptions = {},
) {
  const { enabled = true, staleTime = 60_000 } = options;
  const hasMinimumInput =
    payload != null && payload.input.purchasePrice > 0 && payload.input.arv > 0;
  return useQuery<DealGradingResult, Error>({
    queryKey: ["grade-flip-deal", JSON.stringify(payload).slice(0, 400)],
    queryFn: () => {
      if (!payload) throw new Error("useGradeFlipDeal: payload is null");
      return fetchGradeFlipDeal(payload);
    },
    enabled: enabled && hasMinimumInput,
    staleTime,
  });
}
