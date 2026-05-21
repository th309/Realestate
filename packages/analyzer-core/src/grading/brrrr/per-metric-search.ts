/**
 * Per-metric upgrade search for BRRRR. Mirrors B&H's per-metric-search but
 * uses the BRRRR-shaped input + lever set. Returns the FULL metrics array
 * after a one-knob change so the orchestrator can read each metric's
 * individual grade (decoupled from the overall letter).
 */
import { gradeBrrrrDeal } from "./grade";
import type { BrrrrContext, BrrrrGradingInput, BrrrrThresholds } from "./types";
import {
  BRRRR_PRECISION,
  meetsTarget,
  type BrrrrUpgradeLever,
} from "./upgrade-path-helpers";
import type { Letter, MetricResult } from "../shared/types";

export function gradeMetricsWithLever(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  lever: BrrrrUpgradeLever,
  candidate: number,
): MetricResult[] {
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
  return gradeBrrrrDeal(next, context, thresholds).metrics;
}

/**
 * Binary-search the smallest move on `lever` that lifts a SPECIFIC metric
 * (identified by metricKey) to `targetGrade`. Returns null when the bound
 * doesn't reach the target on this lever for this metric.
 */
export function findSmallestMoveForMetric(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  lever: BrrrrUpgradeLever,
  currentValue: number,
  boundValue: number,
  metricKey: string,
  targetGrade: Letter,
): number | null {
  if (boundValue === currentValue) return null;

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
  const precision = BRRRR_PRECISION[lever];

  while (Math.abs(hi - lo) > precision) {
    const mid = (lo + hi) / 2;
    const midGrade = gradeAt(mid);
    if (midGrade != null && meetsTarget(midGrade, targetGrade)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  // Lever-native rounding toward the bound for safety.
  if (lever === "holdMonthsBeforeRefi") {
    const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
    const g = gradeAt(rounded);
    if (g != null && meetsTarget(g, targetGrade)) return rounded;
    return hi;
  }
  if (lever === "refiRate") {
    const factor = 100;
    const rounded =
      boundValue < currentValue
        ? Math.floor(hi * factor) / factor
        : Math.ceil(hi * factor) / factor;
    const g = gradeAt(rounded);
    if (g != null && meetsTarget(g, targetGrade)) return rounded;
    return hi;
  }
  if (lever === "refiLtvPct") {
    const factor = 1000;
    const rounded =
      boundValue < currentValue
        ? Math.floor(hi * factor) / factor
        : Math.ceil(hi * factor) / factor;
    const g = gradeAt(rounded);
    if (g != null && meetsTarget(g, targetGrade)) return rounded;
    return hi;
  }
  const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
  const g = gradeAt(rounded);
  if (g != null && meetsTarget(g, targetGrade)) return rounded;
  return hi;
}
