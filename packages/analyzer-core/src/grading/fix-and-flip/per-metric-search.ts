/**
 * Per-metric upgrade search for Fix & Flip. Mirrors B&H's per-metric-search
 * but uses the F&F-shaped input + lever set. Returns the FULL metrics array
 * after a one-knob change so the orchestrator can read each metric's
 * individual grade.
 */
import { gradeFixAndFlipDeal } from "./grade";
import type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./types";
import {
  FLIP_PRECISION,
  meetsTarget,
  type FlipUpgradeLever,
} from "./upgrade-path-helpers";
import type { Letter, MetricResult } from "../shared/types";

export function gradeMetricsWithLever(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  lever: FlipUpgradeLever,
  candidate: number,
): MetricResult[] {
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
      next = { ...input, interestRatePct: candidate };
      break;
  }
  return gradeFixAndFlipDeal(next, context, thresholds).metrics;
}

export function findSmallestMoveForMetric(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  lever: FlipUpgradeLever,
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
  const precision = FLIP_PRECISION[lever];

  while (Math.abs(hi - lo) > precision) {
    const mid = (lo + hi) / 2;
    const midGrade = gradeAt(mid);
    if (midGrade != null && meetsTarget(midGrade, targetGrade)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  if (lever === "holdMonths") {
    const rounded = boundValue < currentValue ? Math.floor(hi) : Math.ceil(hi);
    const g = gradeAt(rounded);
    if (g != null && meetsTarget(g, targetGrade)) return rounded;
    return hi;
  }
  if (lever === "financingRate") {
    const factor = 100;
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
