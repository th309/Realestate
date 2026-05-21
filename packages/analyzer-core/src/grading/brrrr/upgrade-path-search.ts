/**
 * Per-lever binary search + combination hint for the BRRRR upgrade-path engine.
 * Mirrors fix-and-flip/upgrade-path-search.ts.
 */
import { gradeBrrrrDeal } from "./grade";
import type { Letter } from "../shared/types";
import type { BrrrrContext, BrrrrGradingInput, BrrrrThresholds } from "./types";
import {
  BRRRR_PRECISION,
  meetsTarget,
  roundTo,
  type BrrrrUpgradeLever,
} from "./upgrade-path-helpers";

/** Re-grade with one lever modified; everything else held constant. */
export function gradeWithLever(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  lever: BrrrrUpgradeLever,
  candidate: number,
): Letter {
  let next: BrrrrGradingInput;
  switch (lever) {
    case "purchasePrice":
      next = { ...input, purchasePrice: candidate };
      break;
    case "arv":
      next = { ...input, arv: candidate };
      break;
    case "rehabCost":
      next = { ...input, rehabCost: candidate };
      break;
    case "refiLtvPct":
      next = { ...input, refiLtvPct: candidate };
      break;
    case "monthlyRent":
      next = { ...input, monthlyRent: candidate };
      break;
    case "holdMonthsBeforeRefi":
      next = { ...input, holdMonthsBeforeRefi: candidate };
      break;
    case "refiRate":
      next = { ...input, refiRate: candidate };
      break;
  }
  return gradeBrrrrDeal(next, context, thresholds).letter;
}

/**
 * Binary-search the smallest move on `lever` (from `currentValue` toward
 * `boundValue`) that lifts the grade to `targetGrade`. Returns null if even
 * the bound itself doesn't reach the target.
 */
export function findSmallestMove(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  lever: BrrrrUpgradeLever,
  currentValue: number,
  boundValue: number,
  targetGrade: Letter,
): number | null {
  // If bound equals current (lever already at its floor/ceiling), no room.
  if (boundValue === currentValue) return null;

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
  const precision = BRRRR_PRECISION[lever];

  while (Math.abs(hi - lo) > precision) {
    const mid = (lo + hi) / 2;
    const midLetter = gradeWithLever(input, context, thresholds, lever, mid);
    if (meetsTarget(midLetter, targetGrade)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  // Round to lever-native granularity, toward the bound so the rounded value
  // still satisfies the target.
  if (lever === "holdMonthsBeforeRefi") {
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
  if (lever === "refiRate") {
    const factor = 100; // 1 bp in PERCENT units
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
  if (lever === "refiLtvPct") {
    const factor = 1000; // 10 bps of LTV
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
 * effort across the two highest-impact BRRRR levers: purchase reduction +
 * rent boost (the two real moves that simultaneously help cash_left, all-in
 * ratio, AND post-refi cash flow).
 */
export function buildCombinationHint(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  targetGrade: Letter,
): string {
  const priceBound = input.purchasePrice * 0.75;
  const rentBound = input.monthlyRent * 1.15;

  const fullPriceMove = findSmallestMove(
    input,
    context,
    thresholds,
    "purchasePrice",
    input.purchasePrice,
    priceBound,
    targetGrade,
  );
  const fullRentMove = findSmallestMove(
    input,
    context,
    thresholds,
    "monthlyRent",
    input.monthlyRent,
    rentBound,
    targetGrade,
  );

  const priceFull =
    fullPriceMove != null
      ? input.purchasePrice - fullPriceMove
      : input.purchasePrice * 0.15;
  const rentFull =
    fullRentMove != null
      ? fullRentMove - input.monthlyRent
      : input.monthlyRent * 0.1;

  const priceHalf = roundTo(priceFull / 2, 500);
  const rentHalf = roundTo(rentFull / 2, 25);

  return `Combination needed: reduce purchase by ~$${priceHalf.toLocaleString(
    "en-US",
  )} AND push rent up ~$${rentHalf.toLocaleString("en-US")}/mo`;
}
