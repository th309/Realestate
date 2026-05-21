/**
 * Per-metric upgrade search. Mirrors the overall-grade binary search in
 * `upgrade-path-search.ts` but reads each metric's INDIVIDUAL grade instead
 * of the overall letter. That decouples the search from the floor rule
 * (CoC/DSCR caps the overall at D) so we can find suggestions that
 * specifically lift a single metric to its next tier.
 *
 * Pure functions — all I/O of the engine sits in the orchestrator.
 */

import type { DealInput } from "../types";
import { gradeBuyAndHoldDeal } from "./buy-and-hold/grade";
import type {
  GradingContext,
  UpgradeLever,
  UserThresholds,
} from "./buy-and-hold/types";
import type { Letter, MetricResult } from "./shared/types";
import { PRECISION, meetsTarget } from "./upgrade-path-helpers";

/**
 * Re-grade with one lever modified, returning the FULL metrics array. The
 * per-metric search reads each metric's individual grade out of this rather
 * than the overall letter.
 */
export function gradeMetricsWithLever(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  lever: UpgradeLever,
  candidate: number,
): MetricResult[] {
  let next: DealInput;
  if (lever === "purchasePrice") {
    next = { ...input, price: candidate };
  } else if (lever === "monthlyRent") {
    next = { ...input, rentMonthly: candidate };
  } else if (lever === "downPayment") {
    const pct = candidate / input.price;
    next = {
      ...input,
      financing: { ...input.financing, downPaymentPct: pct },
    };
  } else {
    next = {
      ...input,
      financing: { ...input.financing, interestRatePct: candidate },
    };
  }
  return gradeBuyAndHoldDeal(next, context, thresholds).metrics;
}

/**
 * Binary-search the smallest move on `lever` that lifts a SPECIFIC metric
 * (identified by metricKey) to `targetGrade`. Returns null when the bound
 * doesn't reach the target on this lever for this metric.
 */
export function findSmallestMoveForMetric(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  lever: UpgradeLever,
  currentValue: number,
  boundValue: number,
  metricKey: string,
  targetGrade: Letter,
): number | null {
  const gradeAt = (candidate: number): Letter | null => {
    const metrics = gradeMetricsWithLever(
      input,
      context,
      thresholds,
      lever,
      candidate,
    );
    return metrics.find((m) => m.key === metricKey)?.grade ?? null;
  };

  const boundGrade = gradeAt(boundValue);
  if (boundGrade == null || !meetsTarget(boundGrade, targetGrade)) return null;

  const currentGrade = gradeAt(currentValue);
  if (currentGrade != null && meetsTarget(currentGrade, targetGrade)) {
    return currentValue;
  }

  let lo = currentValue;
  let hi = boundValue;
  const precision = PRECISION[lever];

  while (Math.abs(hi - lo) > precision) {
    const mid = (lo + hi) / 2;
    const midGrade = gradeAt(mid);
    if (midGrade != null && meetsTarget(midGrade, targetGrade)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  // Round to lever-native granularity, toward the bound for safety.
  if (
    lever === "purchasePrice" ||
    lever === "monthlyRent" ||
    lever === "downPayment"
  ) {
    const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
    const roundedGrade = gradeAt(rounded);
    if (roundedGrade != null && meetsTarget(roundedGrade, targetGrade))
      return rounded;
    return hi;
  }
  const factor = 100;
  const rounded =
    boundValue < currentValue
      ? Math.floor(hi * factor) / factor
      : Math.ceil(hi * factor) / factor;
  const roundedGrade = gradeAt(rounded);
  if (roundedGrade != null && meetsTarget(roundedGrade, targetGrade))
    return rounded;
  return hi;
}
