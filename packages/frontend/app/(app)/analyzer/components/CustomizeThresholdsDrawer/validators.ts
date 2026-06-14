/**
 * Form-level validators for the Customize Thresholds drawer.
 *
 * - validateMetricThreshold: enforces monotonic A→D ordering matching the
 *   metric's favorable direction (higher_is_better: A>B>C>D; lower: A<B<C<D).
 * - validateAllThresholds: runs validateMetricThreshold across every metric
 *   row for the active strategy. Returns a {key → error|null} map.
 * - validateWeights: enforces sum ≈ 100 (±0.01 tolerance for FP drift).
 *   Original B&H signature retained for test back-compat.
 * - validateWeightsForStrategy: strategy-aware variant that iterates the
 *   weight keys for the active rubric.
 * - validateAssumptions: per-field bounds matching the backend DTO so client
 *   errors mirror server rejections.
 *
 * Each returns either `null` (valid) or a human-readable error string per
 * field — never throws.
 */

import type { MetricThreshold, Strategy } from "@propertyiq/analyzer-core";
import type { AnalyzerDefaults } from "@/lib/data";
import { weightKeysForStrategy, rowsForStrategy } from "./preset-helpers";

export function validateMetricThreshold(t: MetricThreshold): string | null {
  const { A, B, C, D, direction } = t;
  if (
    [A, B, C, D].some(
      (n) => typeof n !== "number" || Number.isNaN(n) || !Number.isFinite(n),
    )
  ) {
    return "All values must be numbers";
  }
  if (direction === "higher_is_better") {
    if (!(A > B && B > C && C > D)) {
      return "Values must decrease: A > B > C > D";
    }
  } else {
    if (!(A < B && B < C && C < D)) {
      return "Values must increase: A < B < C < D";
    }
  }
  return null;
}

export type ThresholdErrors = Record<string, string | null>;

export function validateAllThresholds(
  strategy: Strategy,
  thresholds: unknown,
): ThresholdErrors {
  const out: ThresholdErrors = {};
  const t = thresholds as Record<string, MetricThreshold>;
  for (const row of rowsForStrategy(strategy)) {
    const value = t?.[row.key];
    out[row.key] = value ? validateMetricThreshold(value) : "Missing threshold";
  }
  return out;
}

export interface WeightsValidation {
  valid: boolean;
  sum: number;
}

/**
 * Original B&H validator — kept for back-compat with existing tests.
 * New code paths should use `validateWeightsForStrategy`.
 */
export function validateWeights(w: {
  cashOnCash: number;
  dscr: number;
  cashFlowPerDoor: number;
  capRate: number;
  breakEvenOccupancy: number;
}): WeightsValidation {
  const sum =
    (w.cashOnCash || 0) +
    (w.dscr || 0) +
    (w.cashFlowPerDoor || 0) +
    (w.capRate || 0) +
    (w.breakEvenOccupancy || 0);
  return { valid: Math.abs(sum - 100) <= 0.01, sum };
}

export function validateWeightsForStrategy(
  strategy: Strategy,
  weights: unknown,
): WeightsValidation {
  const w = (weights as Record<string, number>) ?? {};
  let sum = 0;
  for (const key of weightKeysForStrategy(strategy)) {
    sum += w[key] || 0;
  }
  return { valid: Math.abs(sum - 100) <= 0.01, sum };
}

type AssumptionErrors = Record<keyof AnalyzerDefaults, string | null>;

/**
 * Mirrors `AnalyzerDefaultsDto` server bounds:
 *  - vacancy/maintenance/capex/pm: [0, 1]
 *  - closingCosts: [0, 0.2]
 *  - rentGrowth/appreciation: [0, 0.5]
 *  - holdYears: integer [1, 30]
 */
export function validateAssumptions(a: AnalyzerDefaults): AssumptionErrors {
  const out: AssumptionErrors = {
    vacancyPct: null,
    maintenancePct: null,
    capexPct: null,
    pmPct: null,
    rentGrowthPct: null,
    appreciationPct: null,
    holdYears: null,
    closingCostsPct: null,
  };
  const pct01: Array<keyof AnalyzerDefaults> = [
    "vacancyPct",
    "maintenancePct",
    "capexPct",
    "pmPct",
  ];
  for (const k of pct01) {
    const v = a[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || Number.isNaN(v)) out[k] = "Must be a number";
    else if (v < 0 || v > 1) out[k] = "Must be between 0% and 100%";
  }
  for (const k of ["rentGrowthPct", "appreciationPct"] as const) {
    const v = a[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || Number.isNaN(v)) out[k] = "Must be a number";
    else if (v < 0 || v > 0.5) out[k] = "Must be between 0% and 50%";
  }
  if (a.closingCostsPct !== undefined) {
    const v = a.closingCostsPct;
    if (typeof v !== "number" || Number.isNaN(v))
      out.closingCostsPct = "Must be a number";
    else if (v < 0 || v > 0.2)
      out.closingCostsPct = "Must be between 0% and 20%";
  }
  if (a.holdYears !== undefined) {
    const v = a.holdYears;
    if (typeof v !== "number" || Number.isNaN(v))
      out.holdYears = "Must be a number";
    else if (!Number.isInteger(v)) out.holdYears = "Must be a whole number";
    else if (v < 1 || v > 30) out.holdYears = "Must be between 1 and 30 years";
  }
  return out;
}

export function hasAnyAssumptionError(errs: AssumptionErrors): boolean {
  return Object.values(errs).some((v) => v !== null);
}
