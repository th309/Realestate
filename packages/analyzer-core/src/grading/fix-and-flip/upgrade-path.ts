/**
 * Fix & Flip upgrade-path engine.
 *
 * Same CONCEPT as the B&H upgrade-path (smallest realistic move per lever to
 * lift the deal to a target grade), but the levers, bounds, feasibility
 * bands, and labels are calibrated to what flippers actually achieve in the
 * field — not adapted from rental-investor patterns.
 *
 * Levers (see ./upgrade-path-helpers.ts for the calibration notes):
 *   purchasePrice — negotiate below ask (motivated-seller range)
 *   rehabCost     — re-bid / value engineer (better contractor bids)
 *   arv           — re-comp with strict comps (recover sloppy initial comps)
 *   holdMonths    — tighten project schedule (PM discipline)
 *
 * Calls `gradeFixAndFlipDeal()` repeatedly inside a per-lever binary search.
 * ~15 grade calls per lever × 4 levers ≈ 60 calls; sub-100ms.
 */
import { LETTER_RANK, type Letter } from "../shared/types";
import { gradeFixAndFlipDeal } from "./grade";
import { FIX_AND_FLIP_DEFAULTS } from "./thresholds";
import type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./types";
import {
  FEASIBILITY_RANK,
  FLIP_LEVER_BOUNDS,
  FLIP_LEVER_LABEL,
  feasibilityFor,
  formatDeltaFor,
  type FlipUpgradeLever,
  type FlipUpgradeOption,
  type FlipUpgradePathResult,
} from "./upgrade-path-helpers";
import { buildCombinationHint, findSmallestMove } from "./upgrade-path-search";

export function computeFlipUpgradePath(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  targetGrade: Letter,
  thresholds: FixAndFlipThresholds = FIX_AND_FLIP_DEFAULTS,
): FlipUpgradePathResult {
  const baseResult = gradeFixAndFlipDeal(input, context, thresholds);
  const currentGrade = baseResult.letter;

  // Target must be strictly better than current.
  if (LETTER_RANK[targetGrade] <= LETTER_RANK[currentGrade]) {
    return {
      currentGrade,
      targetGrade,
      achievable: false,
      options: [],
    };
  }

  const currentHoldMonths = input.holdMonths ?? input.holdingMonths ?? 6;

  // All bounds live in FLIP_LEVER_BOUNDS (./upgrade-path-helpers.ts) so
  // calibration is a one-file change. Skip a lever entirely when the current
  // value is already 0 (no purchase price / no rehab planned, etc.) — the
  // search has nothing to anchor against.
  const leverConfigs: Array<{
    lever: FlipUpgradeLever;
    currentValue: number;
    boundValue: number;
  }> = [];

  if (input.price > 0) {
    leverConfigs.push({
      lever: "purchasePrice",
      currentValue: input.price,
      boundValue: input.price * FLIP_LEVER_BOUNDS.purchasePrice.multiplier,
    });
  }
  if (input.rehabBudget > 0) {
    leverConfigs.push({
      lever: "rehabCost",
      currentValue: input.rehabBudget,
      boundValue: input.rehabBudget * FLIP_LEVER_BOUNDS.rehabCost.multiplier,
    });
  }
  if (input.arv > 0) {
    leverConfigs.push({
      lever: "arv",
      currentValue: input.arv,
      boundValue: input.arv * FLIP_LEVER_BOUNDS.arv.multiplier,
    });
  }
  leverConfigs.push({
    lever: "holdMonths",
    currentValue: currentHoldMonths,
    boundValue: Math.max(
      1,
      currentHoldMonths - FLIP_LEVER_BOUNDS.holdMonths.monthsDelta,
    ),
  });

  // financingRate lever — only when there IS a loan to buy down. Cash deals
  // skip it entirely (no rate to lower).
  const financingType = input.financingType ?? "cash";
  const currentRate = input.interestRatePct ?? 0;
  if (financingType !== "cash" && currentRate > 0) {
    leverConfigs.push({
      lever: "financingRate",
      currentValue: currentRate,
      boundValue: Math.max(
        0,
        currentRate - FLIP_LEVER_BOUNDS.financingRate.rateDelta,
      ),
    });
  }

  const options: FlipUpgradeOption[] = [];

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
      label: FLIP_LEVER_LABEL[lever],
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
