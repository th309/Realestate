"use client";

/**
 * Wires the BRRRR upgrade-path panel to the analyzer's split state.
 *
 * The BRRRR engine accepts one BrrrrGradingInput, but the analyzer UI
 * splits those fields across multiple owners:
 *   • price + financing + tax + insurance + HOA + rent + ratios → analyzer.input
 *   • ARV                                                       → arvLocal
 *   • rehab budget                                              → rehabBudget
 *   • refi LTV + seasoning + rehab months + lease months        → assumptions
 *
 * Returns props that can be spread onto <GradingResultPanel ... {...brrrrProps} />.
 * Each lever's apply-handler routes to the correct setter so a single click
 * lands on the right state slice.
 */
import { useCallback, useMemo } from "react";
import type { BrrrrUpgradeOption, DealInput } from "@propertyiq/analyzer-core";
import type { UpgradePathBrrrrRequest } from "@/lib/data";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";

export interface UseBrrrrUpgradePropsArgs {
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

export function useBrrrrUpgradeProps({
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
}: UseBrrrrUpgradePropsArgs) {
  // Total hold = seasoning + rehab. Match the same computation used in
  // use-grading-result.ts so the upgrade engine grades the same deal the
  // user is seeing.
  const holdMonthsBeforeRefi = Math.max(
    1,
    Math.min(24, assumptions.seasoningMonths + assumptions.rehabMonths),
  );

  const refiTermYears: 15 | 20 | 30 =
    input.financing.termYears === 15 || input.financing.termYears === 20
      ? input.financing.termYears
      : 30;

  const brrrrInput: UpgradePathBrrrrRequest["input"] = useMemo(
    () => ({
      strategy: "BRRRR",
      purchasePrice: input.price,
      arv: arvLocal,
      rehabCost: rehabBudget,
      rehabContingencyPct: 0.1,
      buyClosingPct: input.financing.closingCostsPct ?? 0.03,
      holdMonthsBeforeRefi,
      initialFinancingType: "hard_money",
      hardMoneyRate: 12,
      hardMoneyPoints: 0.02,
      hardMoneyLtcPct: 0.8,
      propertyTaxAnnual: input.taxAnnual ?? 0,
      insuranceAnnual: input.insuranceAnnual ?? 0,
      utilitiesMonthly: 0,
      hoaMonthly: input.hoaMonthly ?? 0,
      refiLtvPct: assumptions.refinanceLTVPct,
      refiRate: input.financing.interestRatePct,
      refiTermYears,
      refiClosingPct: 0.025,
      monthlyRent: input.rentMonthly ?? 0,
      vacancyPct: input.vacancyPctOfRent ?? 0.05,
      maintenancePct: input.maintenancePctOfRent ?? 0.08,
      capexPct: 0,
      pmPct: input.managementPctOfRent ?? 0.08,
      unitCount: input.unitCount ?? 1,
      marketZip,
    }),
    [
      input.price,
      input.financing.closingCostsPct,
      input.financing.interestRatePct,
      input.taxAnnual,
      input.insuranceAnnual,
      input.hoaMonthly,
      input.rentMonthly,
      input.vacancyPctOfRent,
      input.maintenancePctOfRent,
      input.managementPctOfRent,
      input.unitCount,
      arvLocal,
      rehabBudget,
      holdMonthsBeforeRefi,
      assumptions.refinanceLTVPct,
      refiTermYears,
      marketZip,
    ],
  );

  const brrrrContext: UpgradePathBrrrrRequest["context"] = useMemo(
    () => ({
      rehabVerification: "estimate",
      rehabRiskAccepted: true,
      rentEstimateSource: "estimate",
      marketPiqScore: marketPiqScore ?? undefined,
    }),
    [marketPiqScore],
  );

  // Per-lever apply — BRRRR levers route to multiple state slices.
  const onApplyBrrrrLever = useCallback(
    (option: BrrrrUpgradeOption) => {
      switch (option.lever) {
        case "purchasePrice":
          setInput((prev) => ({ ...prev, price: option.targetValue }));
          return;
        case "arv":
          setArvLocal(option.targetValue);
          return;
        case "rehabCost":
          setRehabBudget(option.targetValue);
          return;
        case "refiLtvPct":
          setAssumption("refinanceLTVPct", option.targetValue);
          return;
        case "monthlyRent":
          setInput((prev) => ({ ...prev, rentMonthly: option.targetValue }));
          return;
        case "holdMonthsBeforeRefi": {
          // Shortening hold reduces seasoning first (rehab is real construction
          // time you can't compress without descoping). Floor seasoning at 1.
          const newSeasoning = Math.max(
            1,
            option.targetValue - assumptions.rehabMonths,
          );
          setAssumption("seasoningMonths", newSeasoning);
          return;
        }
        case "refiRate":
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
    [
      setInput,
      setArvLocal,
      setRehabBudget,
      setAssumption,
      assumptions.rehabMonths,
    ],
  );

  return {
    brrrrInput,
    brrrrContext,
    onApplyBrrrrLever,
  };
}
