"use client";

import { useGradeDeal, useGradeFlipDeal } from "@/lib/data";
import type { FixAndFlipGradeRequest } from "@/lib/data";
import type {
  DealInput,
  Strategy as EngineStrategy,
} from "@propertyiq/analyzer-core";
import type { Strategy as AnalyzerStrategy } from "./strategy-tile-mappers";

const STRATEGY_MAP: Partial<Record<AnalyzerStrategy, EngineStrategy>> = {
  buyAndHold: "BUY_AND_HOLD",
  flip: "FIX_AND_FLIP",
  brrrr: "BRRRR",
};

export function toEngineStrategy(
  s: AnalyzerStrategy,
): EngineStrategy | undefined {
  return STRATEGY_MAP[s];
}

export interface UseGradingResultArgs {
  input: DealInput;
  activeStrategy: AnalyzerStrategy;
  hasGradableInput: boolean;
  piqScore?: number | null;
  arv?: number;
  rehabBudget?: number;
  holdingMonths?: number;
  sellingCostsPct?: number;
  marketZip?: string;
}

/**
 * Wires the analyzer's reactive input → POST /api/analyzer/grade (B&H) or
 * /api/analyzer/grade-flip (F&F).
 *
 *   buyAndHold → /grade with B&H DealInput (committed path, unchanged)
 *   flip       → /grade-flip with FixAndFlipGradeRequest. F&F-specific
 *                fields (contingency, financing type, profit floor, MAO
 *                multiplier) are filled with sensible defaults so the panel
 *                renders immediately without forcing extra UI inputs.
 *   brrrr      → disabled until the BRRRR grading engine ships.
 */
export function useGradingResult({
  input,
  activeStrategy,
  hasGradableInput,
  piqScore,
  arv,
  rehabBudget,
  holdingMonths,
  sellingCostsPct,
  marketZip,
}: UseGradingResultArgs) {
  const strategy = STRATEGY_MAP[activeStrategy];

  // B&H — committed call shape preserved.
  const bnhResult = useGradeDeal(
    hasGradableInput && strategy
      ? {
          strategy,
          input,
          context: { marketPiqScore: piqScore ?? undefined },
        }
      : null,
    { enabled: hasGradableInput && strategy === "BUY_AND_HOLD" },
  );

  // F&F — build FixAndFlipGradeRequest with sensible defaults.
  const hasFlipInput =
    hasGradableInput &&
    strategy === "FIX_AND_FLIP" &&
    input.price > 0 &&
    (arv ?? 0) > 0;

  const flipPayload: FixAndFlipGradeRequest | null = hasFlipInput
    ? {
        strategy: "FIX_AND_FLIP",
        input: {
          strategy: "FIX_AND_FLIP",
          purchasePrice: input.price,
          arv: arv ?? 0,
          rehabCost: rehabBudget ?? 0,
          rehabContingencyPct: 0.1,
          holdMonths: holdingMonths ?? 6,
          buyClosingPct: input.financing.closingCostsPct ?? 0.03,
          sellingCostsPct: sellingCostsPct ?? 0.07,
          financingType: "conventional",
          downPaymentPct: input.financing.downPaymentPct,
          loanRate: input.financing.interestRatePct,
          loanTermYears: input.financing.termYears,
          propertyTaxAnnual: input.taxAnnual ?? 0,
          insuranceAnnual: input.insuranceAnnual ?? 0,
          utilitiesMonthly: 0,
          hoaMonthly: input.hoaMonthly ?? 0,
          marketZip,
        },
        context: {
          rehabVerification: "estimate",
          rehabRiskAccepted: true,
          extendedHoldAccepted: true,
          minimumNetProfit: 10_000,
          maxAcquisitionMultiplier: 0.7,
          marketPiqScore: piqScore ?? undefined,
        },
      }
    : null;

  const flipResult = useGradeFlipDeal(flipPayload, { enabled: hasFlipInput });

  // Both hooks run unconditionally (React rules), but only the active one
  // has `enabled: true`. Surface whichever matches the active strategy.
  if (strategy === "FIX_AND_FLIP") return flipResult;
  return bnhResult;
}
