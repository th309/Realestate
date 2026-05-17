/**
 * Upgrade-path engine: given a current deal that grades below a target letter,
 * find the smallest single-lever move (price, rent, down payment, rate) that
 * lifts the deal to the target grade or better. When no single lever reaches
 * the target, surface a combination hint instead.
 *
 * Calls `gradeDeal()` repeatedly inside a per-lever binary search. ~15 grade
 * calls per lever × 4 levers ≈ 60 calls per request; comfortably sub-100ms.
 *
 * Implementation is split across three files to satisfy CLAUDE.md §1.3:
 *   - upgrade-path-helpers.ts: lever metadata, formatting, feasibility, rounding
 *   - upgrade-path-search.ts:  binary search + combination hint builder
 *   - upgrade-path.ts (here):  public computeUpgradePath orchestrator
 */
import type { DealInput } from "../types";
import { gradeDeal } from "./grade";
import { LETTER_RANK } from "./grade-helpers";
import { BUY_AND_HOLD_DEFAULTS } from "./thresholds";
import type {
  GradingContext,
  Letter,
  UpgradeLever,
  UpgradePathOption,
  UpgradePathResult,
  UserThresholds,
} from "./types";
import {
  FEASIBILITY_RANK,
  LEVER_LABEL,
  feasibilityFor,
  formatDeltaFor,
} from "./upgrade-path-helpers";
import { buildCombinationHint, findSmallestMove } from "./upgrade-path-search";

export function computeUpgradePath(
  input: DealInput,
  context: GradingContext,
  targetGrade: Letter,
  thresholds: UserThresholds = BUY_AND_HOLD_DEFAULTS,
): UpgradePathResult {
  const baseResult = gradeDeal(input, context, thresholds);
  const currentGrade = baseResult.letter;

  // Target must be strictly better than current (higher LETTER_RANK = better).
  if (LETTER_RANK[targetGrade] <= LETTER_RANK[currentGrade]) {
    return {
      currentGrade,
      targetGrade,
      achievable: false,
      options: [],
    };
  }

  const rent = input.rentMonthly;
  const currentDownPaymentDollars =
    input.price * input.financing.downPaymentPct;
  const currentRate = input.financing.interestRatePct;

  const leverConfigs: Array<{
    lever: UpgradeLever;
    currentValue: number;
    boundValue: number;
  }> = [
    {
      lever: "purchasePrice",
      currentValue: input.price,
      boundValue: input.price * 0.7,
    },
    ...(rent != null && rent > 0
      ? [
          {
            lever: "monthlyRent" as const,
            currentValue: rent,
            boundValue: rent * 1.25,
          },
        ]
      : []),
    {
      lever: "downPayment",
      currentValue: currentDownPaymentDollars,
      boundValue: input.price * 0.5,
    },
    {
      lever: "interestRate",
      currentValue: currentRate,
      boundValue: Math.max(0, currentRate - 1.5),
    },
  ];

  const options: UpgradePathOption[] = [];

  for (const { lever, currentValue, boundValue } of leverConfigs) {
    const targetValue = findSmallestMove(
      input,
      context,
      thresholds,
      lever,
      currentValue,
      boundValue,
      targetGrade,
    );
    if (targetValue == null) continue; // Bound can't reach target on this lever alone.

    const delta = targetValue - currentValue;
    const feasibility = feasibilityFor(lever, delta, currentValue);
    options.push({
      lever,
      label: LEVER_LABEL[lever],
      currentValue,
      targetValue,
      delta,
      formattedDelta: formatDeltaFor(lever, delta),
      feasibility,
      unlocksGrade: targetGrade,
    });
  }

  // Sort: easy → moderate → hard, then smallest |delta/current| within tier.
  options.sort((a, b) => {
    const tier =
      FEASIBILITY_RANK[a.feasibility] - FEASIBILITY_RANK[b.feasibility];
    if (tier !== 0) return tier;
    const relA =
      a.currentValue === 0 ? Infinity : Math.abs(a.delta / a.currentValue);
    const relB =
      b.currentValue === 0 ? Infinity : Math.abs(b.delta / b.currentValue);
    return relA - relB;
  });

  if (options.length === 0) {
    return {
      currentGrade,
      targetGrade,
      achievable: false,
      options: [],
      combinationHint: buildCombinationHint(
        input,
        context,
        thresholds,
        targetGrade,
      ),
    };
  }

  return {
    currentGrade,
    targetGrade,
    achievable: true,
    options,
  };
}
