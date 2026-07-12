"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/tracker";
import { recordInstallValueMoment } from "@/lib/pwa/install-value-moment";
import { useGradeBrrrrDeal, useGradeDeal, useGradeFlipDeal } from "@/lib/data";
import type { BrrrrGradeRequest, FixAndFlipGradeRequest } from "@/lib/data";
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

/**
 * Feature-coverage signal: fired once when the analyzer first has gradable
 * input. Side-effect-only — lands a `feature.analyzer_grade` row in
 * `user_events` so the coverage signal can see the analyzer was used.
 */
export function emitGradeCoverageEvent(props: {
  strategy: string;
  hasRent: boolean;
}) {
  trackEvent("feature.analyzer_grade", props);
  recordInstallValueMoment();
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
  // BRRRR-specific assumptions (sourced from AnalyzerAssumptions).
  refinanceLTVPct?: number;
  seasoningMonths?: number;
  rehabMonths?: number;
}

/**
 * Wires the analyzer's reactive input → POST /api/analyzer/grade (B&H),
 * /grade-flip (F&F), or /grade-brrrr (BRRRR).
 *
 *   buyAndHold → /grade with B&H DealInput (committed path, unchanged)
 *   flip       → /grade-flip with FixAndFlipGradeRequest. F&F-specific
 *                fields (contingency, financing type, profit floor, MAO
 *                multiplier) are filled with sensible defaults so the panel
 *                renders immediately without forcing extra UI inputs.
 *   brrrr      → /grade-brrrr with BrrrrGradeRequest. BRRRR-specific fields
 *                that don't yet have InputPanel exposure (hardMoneyRate,
 *                hardMoneyPoints, refiTermYears, initialFinancingType) use
 *                textbook BRRRR defaults; the rest derive from existing
 *                input + assumptions.
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
  refinanceLTVPct,
  seasoningMonths,
  rehabMonths,
}: UseGradingResultArgs) {
  const strategy = STRATEGY_MAP[activeStrategy];

  // Coverage signal: emit once when gradable input first appears.
  const gradeCoverageFiredRef = useRef(false);
  useEffect(() => {
    if (hasGradableInput && !gradeCoverageFiredRef.current) {
      gradeCoverageFiredRef.current = true;
      emitGradeCoverageEvent({
        strategy: String(activeStrategy),
        hasRent: (input.rentMonthly ?? 0) > 0,
      });
    }
  }, [hasGradableInput, activeStrategy, input.rentMonthly]);

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

  // BRRRR — build BrrrrGradeRequest with sensible defaults for fields not
  // yet exposed in InputPanel (financing type, hard-money points/rate, term).
  const monthlyRent = input.rentMonthly ?? 0;
  const hasBrrrrInput =
    hasGradableInput &&
    strategy === "BRRRR" &&
    input.price > 0 &&
    (arv ?? 0) > 0 &&
    monthlyRent > 0;

  const refiTermYears: 15 | 20 | 30 =
    input.financing.termYears === 15 || input.financing.termYears === 20
      ? input.financing.termYears
      : 30;
  const holdMonthsBeforeRefi = Math.max(
    1,
    Math.min(24, (seasoningMonths ?? 6) + (rehabMonths ?? 3)),
  );

  const brrrrPayload: BrrrrGradeRequest | null = hasBrrrrInput
    ? {
        strategy: "BRRRR",
        input: {
          strategy: "BRRRR",
          purchasePrice: input.price,
          arv: arv ?? 0,
          rehabCost: rehabBudget ?? 0,
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
          refiLtvPct: refinanceLTVPct ?? 0.75,
          refiRate: input.financing.interestRatePct,
          refiTermYears,
          refiClosingPct: 0.025,
          monthlyRent,
          vacancyPct: input.vacancyPctOfRent ?? 0.05,
          maintenancePct: input.maintenancePctOfRent ?? 0.08,
          capexPct: 0,
          pmPct: input.managementPctOfRent ?? 0.08,
          unitCount: input.unitCount ?? 1,
          marketZip,
        },
        context: {
          rehabVerification: "estimate",
          rehabRiskAccepted: true,
          rentEstimateSource: "estimate",
          marketPiqScore: piqScore ?? undefined,
        },
      }
    : null;

  const brrrrResult = useGradeBrrrrDeal(brrrrPayload, {
    enabled: hasBrrrrInput,
  });

  // All three hooks run unconditionally (React rules), but only the active
  // one has `enabled: true`. Surface whichever matches the active strategy.
  if (strategy === "FIX_AND_FLIP") return flipResult;
  if (strategy === "BRRRR") return brrrrResult;
  return bnhResult;
}
