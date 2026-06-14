"use client";

/**
 * Wires the F&F upgrade-path panel to the analyzer's split state.
 *
 * The F&F engine accepts one FixAndFlipInput, but the analyzer UI splits
 * those fields across multiple state owners:
 *   • price + financing + tax + insurance + HOA → analyzer.input
 *   • ARV                                       → arvLocal
 *   • rehab budget                              → rehabBudget
 *   • hold months + selling-cost %              → assumptions
 *
 * This hook returns a single object that can be spread onto
 * <GradingResultPanel>, providing the flip-shaped input AND a lever-apply
 * handler that routes each lever to the correct setter — purchase price
 * goes to setInput, ARV to setArvLocal, rehab to setRehabBudget, hold to
 * setAssumption('holdingMonths'), financing rate to setInput.financing.
 *
 * Returned shape is purposefully aligned with GradingResultPanel's F&F
 * prop names so the caller can `<GradingResultPanel ... {...flipProps} />`.
 */
import { useCallback, useMemo } from "react";
import type { DealInput, FlipUpgradeOption } from "@propertyiq/analyzer-core";
import type { UpgradePathFlipRequest } from "@/lib/data";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";

export interface UseFlipUpgradePropsArgs {
  input: DealInput;
  setInput: (next: DealInput | ((prev: DealInput) => DealInput)) => void;
  arvLocal: number;
  setArvLocal: (n: number) => void;
  rehabBudget: number;
  setRehabBudget: (n: number) => void;
  assumptions: AnalyzerAssumptions;
  setAssumption: <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => void;
  marketZip?: string;
  marketPiqScore?: number | null;
}

export function useFlipUpgradeProps({
  input,
  setInput,
  arvLocal,
  setArvLocal,
  rehabBudget,
  setRehabBudget,
  assumptions,
  setAssumption,
  marketZip,
  marketPiqScore,
}: UseFlipUpgradePropsArgs) {
  // Flip-shaped input — matches what /api/analyzer/grade-flip and
  // /api/analyzer/upgrade-path-flip both expect. Defaults align with the
  // ones use-grading-result.ts uses for the grade payload, so the upgrade
  // path computes against the same deal the user is seeing graded.
  const flipInput: UpgradePathFlipRequest["input"] = useMemo(
    () => ({
      strategy: "FIX_AND_FLIP",
      purchasePrice: input.price,
      arv: arvLocal,
      rehabCost: rehabBudget,
      rehabContingencyPct: 0.1,
      holdMonths: assumptions.holdingMonths,
      buyClosingPct: input.financing.closingCostsPct ?? 0.03,
      sellingCostsPct: assumptions.sellingCostsPct,
      financingType: "conventional",
      downPaymentPct: input.financing.downPaymentPct,
      loanRate: input.financing.interestRatePct,
      loanTermYears: input.financing.termYears,
      propertyTaxAnnual: input.taxAnnual ?? 0,
      insuranceAnnual: input.insuranceAnnual ?? 0,
      utilitiesMonthly: 0,
      hoaMonthly: input.hoaMonthly ?? 0,
      marketZip,
    }),
    [
      input.price,
      input.financing.closingCostsPct,
      input.financing.downPaymentPct,
      input.financing.interestRatePct,
      input.financing.termYears,
      input.taxAnnual,
      input.insuranceAnnual,
      input.hoaMonthly,
      arvLocal,
      rehabBudget,
      assumptions.holdingMonths,
      assumptions.sellingCostsPct,
      marketZip,
    ],
  );

  const flipContext: UpgradePathFlipRequest["context"] = useMemo(
    () => ({
      rehabVerification: "estimate",
      rehabRiskAccepted: true,
      extendedHoldAccepted: true,
      minimumNetProfit: 10_000,
      maxAcquisitionMultiplier: 0.7,
      marketPiqScore: marketPiqScore ?? undefined,
    }),
    [marketPiqScore],
  );

  // Per-lever apply — F&F levers map to DIFFERENT analyzer-state setters.
  // purchasePrice / financingRate update analyzer.input; everything else
  // updates a sibling state slice.
  const onApplyFlipLever = useCallback(
    (option: FlipUpgradeOption) => {
      switch (option.lever) {
        case "purchasePrice":
          setInput((prev) => ({ ...prev, price: option.targetValue }));
          return;
        case "rehabCost":
          setRehabBudget(option.targetValue);
          return;
        case "arv":
          setArvLocal(option.targetValue);
          return;
        case "holdMonths":
          setAssumption("holdingMonths", option.targetValue);
          return;
        case "financingRate":
          setInput((prev) => ({
            ...prev,
            financing: {
              ...prev.financing,
              interestRatePct: option.targetValue,
            },
          }));
          return;
      }
    },
    [setInput, setArvLocal, setRehabBudget, setAssumption],
  );

  const onApplyFlipCombination = useCallback(
    (combo: { priceDelta: number; rehabDelta: number }) => {
      setInput((prev) => ({
        ...prev,
        price: Math.max(0, prev.price + combo.priceDelta),
      }));
      setRehabBudget(Math.max(0, rehabBudget + combo.rehabDelta));
    },
    [setInput, setRehabBudget, rehabBudget],
  );

  return {
    flipInput,
    flipContext,
    onApplyFlipLever,
    onApplyFlipCombination,
  };
}
