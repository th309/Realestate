/**
 * Per-lever binary search + combination hint for the F&F upgrade-path engine.
 * Mirrors grading/upgrade-path-search.ts (the B&H equivalent).
 */
import { gradeFixAndFlipDeal } from "./grade";
import type { Letter } from "../shared/types";
import type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./types";
import {
  FLIP_PRECISION,
  meetsTarget,
  roundTo,
  type FlipUpgradeLever,
} from "./upgrade-path-helpers";

/** Re-grade with one lever modified; everything else held constant. */
export function gradeWithLever(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  lever: FlipUpgradeLever,
  candidate: number,
): Letter {
  let next: FixAndFlipInput;
  switch (lever) {
    case "purchasePrice":
      next = { ...input, price: candidate };
      break;
    case "rehabCost":
      next = { ...input, rehabBudget: candidate };
      break;
    case "arv":
      next = { ...input, arv: candidate };
      break;
    case "holdMonths":
      next = { ...input, holdMonths: candidate };
      break;
    case "financingRate":
      // candidate is in PERCENT units (12 = 12%)
      next = { ...input, interestRatePct: candidate };
      break;
  }
  return gradeFixAndFlipDeal(next, context, thresholds).letter;
}

/**
 * Binary-search the smallest move on `lever` (from `currentValue` toward
 * `boundValue`) that lifts the grade to `targetGrade`. Returns null if even
 * the bound itself doesn't reach the target.
 */
export function findSmallestMove(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  lever: FlipUpgradeLever,
  currentValue: number,
  boundValue: number,
  targetGrade: Letter,
): number | null {
  const boundLetter = gradeWithLever(
    input,
    context,
    thresholds,
    lever,
    boundValue,
  );
  if (!meetsTarget(boundLetter, targetGrade)) return null;

  const currentLetter = gradeWithLever(
    input,
    context,
    thresholds,
    lever,
    currentValue,
  );
  if (meetsTarget(currentLetter, targetGrade)) return currentValue;

  let lo = currentValue;
  let hi = boundValue;
  const precision = FLIP_PRECISION[lever];

  while (Math.abs(hi - lo) > precision) {
    const mid = (lo + hi) / 2;
    const midLetter = gradeWithLever(input, context, thresholds, lever, mid);
    if (meetsTarget(midLetter, targetGrade)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  // Round to lever-native granularity.
  if (lever === "holdMonths") {
    // Whole-month granularity (spec). Round toward the bound so it still
    // satisfies.
    const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
    const roundedLetter = gradeWithLever(
      input,
      context,
      thresholds,
      lever,
      rounded,
    );
    if (meetsTarget(roundedLetter, targetGrade)) return rounded;
    return hi;
  }
  if (lever === "financingRate") {
    // 0.01pp granularity in PERCENT units (i.e., 1 bp). Round toward bound.
    const factor = 100; // 0.01pp
    const rounded =
      boundValue < currentValue
        ? Math.floor(hi * factor) / factor
        : Math.ceil(hi * factor) / factor;
    const roundedLetter = gradeWithLever(
      input,
      context,
      thresholds,
      lever,
      rounded,
    );
    if (meetsTarget(roundedLetter, targetGrade)) return rounded;
    return hi;
  }
  // Dollar-valued levers — whole-dollar rounding toward the bound.
  const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
  const roundedLetter = gradeWithLever(
    input,
    context,
    thresholds,
    lever,
    rounded,
  );
  if (meetsTarget(roundedLetter, targetGrade)) return rounded;
  return hi;
}

/**
 * Two-lever fallback hint when no single lever reaches the target. Splits
 * effort across the two highest-impact F&F levers: purchase reduction +
 * rehab reduction (the two real knobs a flipper actually owns).
 */
export function buildCombinationHint(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  targetGrade: Letter,
): string {
  const priceBound = input.price * 0.7;
  const rehabBound = input.rehabBudget * 0.7;

  const fullPriceMove = findSmallestMove(
    input,
    context,
    thresholds,
    "purchasePrice",
    input.price,
    priceBound,
    targetGrade,
  );
  const fullRehabMove = findSmallestMove(
    input,
    context,
    thresholds,
    "rehabCost",
    input.rehabBudget,
    rehabBound,
    targetGrade,
  );

  const priceFull =
    fullPriceMove != null ? input.price - fullPriceMove : input.price * 0.15;
  const rehabFull =
    fullRehabMove != null
      ? input.rehabBudget - fullRehabMove
      : input.rehabBudget * 0.15;

  const priceHalf = roundTo(priceFull / 2, 500);
  const rehabHalf = roundTo(rehabFull / 2, 500);

  return `Combination needed: reduce price by ~$${priceHalf.toLocaleString(
    "en-US",
  )} AND trim rehab by ~$${rehabHalf.toLocaleString("en-US")}`;
}
