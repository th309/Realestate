/**
 * Per-metric upgrade orchestrator. For each non-A metric in a B&H grading
 * result, finds the smallest single-lever moves that would lift THAT metric
 * to its next-better grade tier.
 *
 * The answer to "all my metrics are failing — show me what to do for each."
 * The overall-grade upgrade-path engine surfaces ONE lever per target letter;
 * this engine surfaces 2–3 levers per failing metric so the user can see
 * which knob fixes which number.
 *
 * Per-metric lever applicability matters: increasing the down payment helps
 * DSCR (less loan = less debt service) but HURTS cash-on-cash (more cash
 * deployed), so it shouldn't appear under CoC. The LEVER_MAP encodes which
 * levers apply to which metrics and the direction each moves.
 */
import type { DealInput } from "../types";
import type {
  GradingContext,
  PerMetricUpgrade,
  UpgradeLever,
  UpgradePathOption,
  UserThresholds,
} from "./buy-and-hold/types";
import {
  FEASIBILITY_RANK,
  LEVER_LABEL,
  feasibilityFor,
  formatDeltaFor,
} from "./upgrade-path-helpers";
import { findSmallestMoveForMetric } from "./per-metric-search";
import { LETTER_RANK, type Letter, type MetricResult } from "./shared/types";

const LETTER_ORDER: Letter[] = ["F", "D", "C", "B", "A"];

/** Smallest tier above `current` — e.g., F → D, C → B, A → A (no-op). */
function nextTierAbove(current: Letter): Letter | null {
  const idx = LETTER_ORDER.indexOf(current);
  if (idx < 0 || idx >= LETTER_ORDER.length - 1) return null;
  return LETTER_ORDER[idx + 1];
}

interface LeverConfig {
  lever: UpgradeLever;
  /** How to compute the search bound for this lever given the input. */
  boundFor: (input: DealInput) => number | null;
  /** How to compute the current value for the lever. */
  currentFor: (input: DealInput) => number;
}

const PURCHASE_PRICE_LEVER: LeverConfig = {
  lever: "purchasePrice",
  currentFor: (i) => i.price,
  boundFor: (i) => i.price * 0.7, // -30%
};

const MONTHLY_RENT_LEVER: LeverConfig = {
  lever: "monthlyRent",
  currentFor: (i) => i.rentMonthly ?? 0,
  boundFor: (i) =>
    i.rentMonthly != null && i.rentMonthly > 0 ? i.rentMonthly * 1.25 : null,
};

const DOWN_PAYMENT_LEVER: LeverConfig = {
  lever: "downPayment",
  currentFor: (i) => i.price * i.financing.downPaymentPct,
  boundFor: (i) => i.price * 0.5,
};

const INTEREST_RATE_LEVER: LeverConfig = {
  lever: "interestRate",
  currentFor: (i) => i.financing.interestRatePct,
  boundFor: (i) => Math.max(0, i.financing.interestRatePct - 1.5),
};

/**
 * Per-metric lever applicability.
 *
 * - cashOnCash: numerator is (NOI − DS), denominator is cash invested. Rent ↑
 *   and rate ↓ both help. Price ↓ helps modestly (lower cash). Down payment
 *   is omitted — raising it grows the denominator faster than DS savings.
 * - dscr: NOI ÷ annual DS. Rent ↑ and rate ↓ help directly. Down payment ↑
 *   helps by lowering the loan. Price doesn't help directly (DS scales with
 *   loan, not price), so omitted.
 * - cashFlowPerDoor: same drivers as DSCR — NOI − DS divided by doors.
 * - capRate: NOI ÷ price. Rent ↑ and price ↓ both help. Financing levers
 *   don't move NOI, so omitted.
 * - breakEvenOccupancy: (opex + DS) ÷ gross rent. Rent ↑, rate ↓, and down
 *   payment ↑ all lower the ratio (better). Price doesn't directly help.
 */
const LEVER_MAP: Record<string, LeverConfig[]> = {
  cashOnCash: [PURCHASE_PRICE_LEVER, MONTHLY_RENT_LEVER, INTEREST_RATE_LEVER],
  dscr: [MONTHLY_RENT_LEVER, INTEREST_RATE_LEVER, DOWN_PAYMENT_LEVER],
  cashFlowPerDoor: [
    MONTHLY_RENT_LEVER,
    INTEREST_RATE_LEVER,
    DOWN_PAYMENT_LEVER,
  ],
  capRate: [PURCHASE_PRICE_LEVER, MONTHLY_RENT_LEVER],
  breakEvenOccupancy: [
    MONTHLY_RENT_LEVER,
    INTEREST_RATE_LEVER,
    DOWN_PAYMENT_LEVER,
  ],
};

function leverOptionsForMetric(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  metric: MetricResult,
  targetGrade: Letter,
): UpgradePathOption[] {
  const configs = LEVER_MAP[metric.key] ?? [];
  const options: UpgradePathOption[] = [];
  for (const cfg of configs) {
    const bound = cfg.boundFor(input);
    if (bound == null) continue;
    const currentValue = cfg.currentFor(input);
    const targetValue = findSmallestMoveForMetric(
      input,
      context,
      thresholds,
      cfg.lever,
      currentValue,
      bound,
      metric.key,
      targetGrade,
    );
    if (targetValue == null) continue;

    const delta = targetValue - currentValue;
    options.push({
      lever: cfg.lever,
      label: LEVER_LABEL[cfg.lever],
      currentValue,
      targetValue,
      delta,
      formattedDelta: formatDeltaFor(cfg.lever, delta),
      feasibility: feasibilityFor(cfg.lever, delta, currentValue),
      unlocksGrade: targetGrade,
    });
  }
  // Sort: easy → moderate → hard, then smallest relative delta.
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
  return options;
}

/**
 * Public API: compute per-metric upgrade suggestions. Skips any metric that
 * already grades A. For each non-A metric, the target is the next better
 * tier and the options list shows applicable levers sorted by feasibility.
 *
 * Returns metrics in worst-first order (lowest current grade first) so the
 * UI surfaces the most urgent failures at the top.
 */
export function computePerMetricUpgrade(
  input: DealInput,
  context: GradingContext,
  thresholds: UserThresholds,
  metrics: MetricResult[],
): PerMetricUpgrade[] {
  const out: PerMetricUpgrade[] = [];
  for (const metric of metrics) {
    if (metric.grade === "A") continue;
    const target = nextTierAbove(metric.grade);
    if (target == null) continue;
    out.push({
      metricKey: metric.key,
      metricLabel: metric.label,
      currentValue: metric.value,
      formattedValue: metric.formattedValue,
      currentGrade: metric.grade,
      targetGrade: target,
      options: leverOptionsForMetric(
        input,
        context,
        thresholds,
        metric,
        target,
      ),
    });
  }
  // Worst grade first (F → D → C → B).
  out.sort((a, b) => LETTER_RANK[a.currentGrade] - LETTER_RANK[b.currentGrade]);
  return out;
}
