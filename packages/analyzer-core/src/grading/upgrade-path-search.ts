/**
 * Per-lever binary search and combination-hint builder for the upgrade-path
 * engine. Pure functions — all I/O of the engine sits in upgrade-path.ts.
 *
 * `gradeWithLever` materializes a one-knob-changed DealInput and re-grades it.
 * `findSmallestMove` binary-searches the smallest move on a lever that lifts
 * the grade to the target, or returns null when even the bound can't reach.
 */
import type { DealInput } from "../types";
import { gradeBuyAndHoldDeal } from "./buy-and-hold/grade";
import type {
  GradingContext,
  UpgradeLever,
  UserThresholds,
} from "./buy-and-hold/types";
import type { Letter } from "./shared/types";
import { PRECISION, meetsTarget, roundTo } from "./upgrade-path-helpers";

/** Re-grade with one lever modified; everything else held constant. */
export function gradeWithLever(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  lever: UpgradeLever,
  candidate: number,
): Letter {
  let next: DealInput;
  if (lever === "purchasePrice") {
    next = { ...input, price: candidate };
  } else if (lever === "monthlyRent") {
    next = { ...input, rentMonthly: candidate };
  } else if (lever === "downPayment") {
    // candidate is dollar amount → convert to downPaymentPct
    const pct = candidate / input.price;
    next = {
      ...input,
      financing: { ...input.financing, downPaymentPct: pct },
    };
  } else {
    // interestRate: candidate is the rate in PERCENT units (e.g., 6.5)
    next = {
      ...input,
      financing: { ...input.financing, interestRatePct: candidate },
    };
  }
  return gradeBuyAndHoldDeal(next, context, thresholds).letter;
}

/**
 * Binary-search the smallest move on `lever` (from `currentValue` toward
 * `boundValue`) that lifts the grade to `targetGrade`. Returns null if even
 * the bound itself doesn't reach the target.
 *
 * Invariant during the loop: lo never satisfies, hi always satisfies. We
 * shrink toward lo until the gap is below `precision`, then hi is the answer.
 */
export function findSmallestMove(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  lever: UpgradeLever,
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
  if (!meetsTarget(boundLetter, targetGrade)) {
    return null;
  }

  const currentLetter = gradeWithLever(
    input,
    context,
    thresholds,
    lever,
    currentValue,
  );
  if (meetsTarget(currentLetter, targetGrade)) {
    // No move needed at all.
    return currentValue;
  }

  let lo = currentValue;
  let hi = boundValue;
  const precision = PRECISION[lever];

  // Direction-agnostic: lever may move up or down; we only assume hi satisfies.
  while (Math.abs(hi - lo) > precision) {
    const mid = (lo + hi) / 2;
    const midLetter = gradeWithLever(input, context, thresholds, lever, mid);
    if (meetsTarget(midLetter, targetGrade)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  // Round to lever-native granularity (whole dollars / 0.01pp).
  if (
    lever === "purchasePrice" ||
    lever === "monthlyRent" ||
    lever === "downPayment"
  ) {
    // Round toward the bound to guarantee the rounded value still satisfies.
    const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
    const roundedLetter = gradeWithLever(
      input,
      context,
      thresholds,
      lever,
      rounded,
    );
    if (meetsTarget(roundedLetter, targetGrade)) return rounded;
    // Fallback: rounding undershot by 1 unit — return the safer hi as-is.
    return hi;
  }
  // interestRate: round to 0.01pp toward the bound (a buydown rounds down).
  const factor = 100; // 0.01pp granularity in percent units
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

/**
 * If no single lever reached target, propose a half-move split across the
 * two most-impactful combination levers (price down + rent up — historically
 * the two levers buyers can both push on). Always returns a string; callers
 * decide whether to attach it.
 */
export function buildCombinationHint(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  targetGrade: Letter,
): string {
  const priceBound = input.price * 0.7;
  const rentBound = (input.rentMonthly ?? 0) * 1.25;

  const fullPriceMove = findSmallestMove(
    input,
    context,
    thresholds,
    "purchasePrice",
    input.price,
    priceBound,
    targetGrade,
  );
  const fullRentMove =
    input.rentMonthly == null
      ? null
      : findSmallestMove(
          input,
          context,
          thresholds,
          "monthlyRent",
          input.rentMonthly,
          rentBound,
          targetGrade,
        );

  // If a lever solo-solved it, half-move it as the combination suggestion.
  // If it couldn't solve solo, use half of the full available range as a probe.
  const priceFull =
    fullPriceMove != null ? input.price - fullPriceMove : input.price * 0.15;
  const rentFull =
    fullRentMove != null && input.rentMonthly != null
      ? fullRentMove - input.rentMonthly
      : (input.rentMonthly ?? 0) * 0.1;

  const priceHalf = roundTo(priceFull / 2, 500);
  const rentHalf = roundTo(rentFull / 2, 25);

  return `Combination needed: reduce price by ~$${priceHalf.toLocaleString(
    "en-US",
  )} AND raise rent by ~$${rentHalf.toLocaleString("en-US")}/mo`;
}
