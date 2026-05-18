/**
 * BRRRR upgrade-path engine.
 *
 * Same CONCEPT as B&H and F&F (smallest realistic move per lever to lift the
 * deal to a target grade), but levers, bounds, and feasibility bands are
 * BRRRR-native — they reflect what a BRRRR operator can actually move on
 * between identifying the deal and closing the refi.
 *
 * Levers (see ./upgrade-path-helpers.ts for the calibration notes):
 *   purchasePrice         — negotiate below ask
 *   arv                   — improve finishes / strict comps
 *   rehabCost             — re-bid / value engineer
 *   refiLtvPct            — shop for a higher-LTV lender
 *   monthlyRent           — push rent (better listing / quality of finish)
 *   holdMonthsBeforeRefi  — tighten schedule (PM discipline)
 *   refiRate              — shop for a better refi rate
 *
 * Calls `gradeBrrrrDeal()` repeatedly inside per-lever binary search.
 * ~15 grade calls per lever × 7 levers ≈ 105 calls; well under 200ms.
 */
import { LETTER_RANK, type Letter } from "../shared/types";
import { gradeBrrrrDeal } from "./grade";
import { BRRRR_DEFAULTS } from "./thresholds";
import type { BrrrrContext, BrrrrGradingInput, BrrrrThresholds } from "./types";
import {
  BRRRR_LEVER_BOUNDS,
  BRRRR_LEVER_LABEL,
  FEASIBILITY_RANK,
  feasibilityFor,
  formatDeltaFor,
  type BrrrrUpgradeLever,
  type BrrrrUpgradeOption,
  type BrrrrUpgradePathResult,
} from "./upgrade-path-helpers";
import { buildCombinationHint, findSmallestMove } from "./upgrade-path-search";

export function computeBrrrrUpgradePath(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  targetGrade: Letter,
  thresholds: BrrrrThresholds = BRRRR_DEFAULTS,
): BrrrrUpgradePathResult {
  const baseResult = gradeBrrrrDeal(input, context, thresholds);
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

  const leverConfigs: Array<{
    lever: BrrrrUpgradeLever;
    currentValue: number;
    boundValue: number;
  }> = [];

  if (input.purchasePrice > 0) {
    leverConfigs.push({
      lever: "purchasePrice",
      currentValue: input.purchasePrice,
      boundValue:
        input.purchasePrice * BRRRR_LEVER_BOUNDS.purchasePrice.multiplier,
    });
  }
  if (input.arv > 0) {
    leverConfigs.push({
      lever: "arv",
      currentValue: input.arv,
      boundValue: input.arv * BRRRR_LEVER_BOUNDS.arv.multiplier,
    });
  }
  if (input.rehabCost > 0) {
    leverConfigs.push({
      lever: "rehabCost",
      currentValue: input.rehabCost,
      boundValue: input.rehabCost * BRRRR_LEVER_BOUNDS.rehabCost.multiplier,
    });
  }
  // refiLtvPct — bound upward but capped at lender ceiling (default 80%).
  leverConfigs.push({
    lever: "refiLtvPct",
    currentValue: input.refiLtvPct,
    boundValue: Math.min(
      BRRRR_LEVER_BOUNDS.refiLtvPct.ceiling,
      input.refiLtvPct + BRRRR_LEVER_BOUNDS.refiLtvPct.ltvDelta,
    ),
  });
  if (input.monthlyRent > 0) {
    leverConfigs.push({
      lever: "monthlyRent",
      currentValue: input.monthlyRent,
      boundValue: input.monthlyRent * BRRRR_LEVER_BOUNDS.monthlyRent.multiplier,
    });
  }
  leverConfigs.push({
    lever: "holdMonthsBeforeRefi",
    currentValue: input.holdMonthsBeforeRefi,
    boundValue: Math.max(
      BRRRR_LEVER_BOUNDS.holdMonthsBeforeRefi.floor,
      input.holdMonthsBeforeRefi -
        BRRRR_LEVER_BOUNDS.holdMonthsBeforeRefi.monthsDelta,
    ),
  });
  if (input.refiRate > 0) {
    leverConfigs.push({
      lever: "refiRate",
      currentValue: input.refiRate,
      boundValue: Math.max(
        0,
        input.refiRate - BRRRR_LEVER_BOUNDS.refiRate.rateDelta,
      ),
    });
  }

  const options: BrrrrUpgradeOption[] = [];

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
    if (targetValue == null) continue;

    const delta = targetValue - currentValue;
    const feasibility = feasibilityFor(lever, delta, currentValue);
    options.push({
      lever,
      label: BRRRR_LEVER_LABEL[lever],
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
