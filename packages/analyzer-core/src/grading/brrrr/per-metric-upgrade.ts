/**
 * Per-metric upgrade orchestrator for BRRRR. For each non-A metric in a
 * grading result, finds the smallest single-lever moves that lift THAT
 * metric to its next-better grade tier.
 *
 * Per-metric lever applicability matters for BRRRR more than B&H because
 * `refiLtvPct` has OPPOSITE effects on different metrics:
 *   - Higher refi LTV → more cash out at refi → improves `cash_left_in_deal`
 *   - Higher refi LTV → bigger refi loan → HURTS `post_refi_dscr` and CFPD
 *
 * The LEVER_MAP encodes the direction each lever moves for each metric.
 */
import type { BrrrrContext, BrrrrGradingInput, BrrrrThresholds } from "./types";
import {
  BRRRR_LEVER_BOUNDS,
  BRRRR_LEVER_LABEL,
  FEASIBILITY_RANK,
  feasibilityFor,
  formatDeltaFor,
  type BrrrrUpgradeLever,
  type BrrrrUpgradeOption,
  type BrrrrPerMetricUpgrade,
} from "./upgrade-path-helpers";
import { findSmallestMoveForMetric } from "./per-metric-search";
import { LETTER_RANK, type Letter, type MetricResult } from "../shared/types";

const LETTER_ORDER: Letter[] = ["F", "D", "C", "B", "A"];

function nextTierAbove(current: Letter): Letter | null {
  const idx = LETTER_ORDER.indexOf(current);
  if (idx < 0 || idx >= LETTER_ORDER.length - 1) return null;
  return LETTER_ORDER[idx + 1];
}

interface BrrrrLeverConfig {
  lever: BrrrrUpgradeLever;
  currentFor: (i: BrrrrGradingInput) => number;
  boundFor: (i: BrrrrGradingInput) => number | null;
}

const PURCHASE_DOWN: BrrrrLeverConfig = {
  lever: "purchasePrice",
  currentFor: (i) => i.purchasePrice,
  boundFor: (i) =>
    i.purchasePrice > 0
      ? i.purchasePrice * BRRRR_LEVER_BOUNDS.purchasePrice.multiplier
      : null,
};

const ARV_UP: BrrrrLeverConfig = {
  lever: "arv",
  currentFor: (i) => i.arv,
  boundFor: (i) =>
    i.arv > 0 ? i.arv * BRRRR_LEVER_BOUNDS.arv.multiplier : null,
};

const REHAB_DOWN: BrrrrLeverConfig = {
  lever: "rehabCost",
  currentFor: (i) => i.rehabCost,
  boundFor: (i) =>
    i.rehabCost > 0
      ? i.rehabCost * BRRRR_LEVER_BOUNDS.rehabCost.multiplier
      : null,
};

const REFI_LTV_UP: BrrrrLeverConfig = {
  lever: "refiLtvPct",
  currentFor: (i) => i.refiLtvPct,
  boundFor: (i) =>
    Math.min(
      BRRRR_LEVER_BOUNDS.refiLtvPct.ceiling,
      i.refiLtvPct + BRRRR_LEVER_BOUNDS.refiLtvPct.ltvDelta,
    ),
};

const REFI_LTV_DOWN: BrrrrLeverConfig = {
  lever: "refiLtvPct",
  currentFor: (i) => i.refiLtvPct,
  boundFor: (i) =>
    Math.max(0.5, i.refiLtvPct - BRRRR_LEVER_BOUNDS.refiLtvPct.ltvDelta),
};

const RENT_UP: BrrrrLeverConfig = {
  lever: "monthlyRent",
  currentFor: (i) => i.monthlyRent,
  boundFor: (i) =>
    i.monthlyRent > 0
      ? i.monthlyRent * BRRRR_LEVER_BOUNDS.monthlyRent.multiplier
      : null,
};

const HOLD_DOWN: BrrrrLeverConfig = {
  lever: "holdMonthsBeforeRefi",
  currentFor: (i) => i.holdMonthsBeforeRefi,
  boundFor: (i) =>
    Math.max(
      BRRRR_LEVER_BOUNDS.holdMonthsBeforeRefi.floor,
      i.holdMonthsBeforeRefi -
        BRRRR_LEVER_BOUNDS.holdMonthsBeforeRefi.monthsDelta,
    ),
};

const REFI_RATE_DOWN: BrrrrLeverConfig = {
  lever: "refiRate",
  currentFor: (i) => i.refiRate,
  boundFor: (i) =>
    i.refiRate > 0
      ? Math.max(0, i.refiRate - BRRRR_LEVER_BOUNDS.refiRate.rateDelta)
      : null,
};

/**
 * Per-metric lever applicability.
 *
 * cash_left_in_deal (lower is better)
 *   - Lower price/rehab → less cash going in
 *   - Higher ARV / higher refi LTV → more cash coming back at refi
 * all_in_to_arv_ratio (lower is better)
 *   - Lower price/rehab/holdMonths/rate → smaller allInCost
 *   - Higher ARV → bigger denominator
 * post_refi_dscr (higher is better)
 *   - Higher rent → more NOI
 *   - Lower refi rate → less DS
 *   - LOWER refi LTV → less debt (opposite of cash_left direction)
 * post_refi_cash_flow_per_door (higher is better)
 *   - Higher rent, lower rate, lower refi LTV (same as DSCR)
 * time_to_refinance_months (lower is better)
 *   - Shorter hold (the only direct lever)
 */
const LEVER_MAP: Record<string, BrrrrLeverConfig[]> = {
  cash_left_in_deal: [PURCHASE_DOWN, REHAB_DOWN, ARV_UP, REFI_LTV_UP],
  all_in_to_arv_ratio: [
    PURCHASE_DOWN,
    REHAB_DOWN,
    ARV_UP,
    HOLD_DOWN,
    REFI_RATE_DOWN,
  ],
  post_refi_dscr: [RENT_UP, REFI_RATE_DOWN, REFI_LTV_DOWN],
  post_refi_cash_flow_per_door: [RENT_UP, REFI_RATE_DOWN, REFI_LTV_DOWN],
  time_to_refinance_months: [HOLD_DOWN],
};

function leverOptionsForMetric(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  metric: MetricResult,
  targetGrade: Letter,
): BrrrrUpgradeOption[] {
  const configs = LEVER_MAP[metric.key] ?? [];
  const options: BrrrrUpgradeOption[] = [];
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
      label: BRRRR_LEVER_LABEL[cfg.lever],
      currentValue,
      targetValue,
      delta,
      formattedDelta: formatDeltaFor(cfg.lever, delta),
      feasibility: feasibilityFor(cfg.lever, delta, currentValue),
      unlocksGrade: targetGrade,
    });
  }
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

export function computeBrrrrPerMetricUpgrade(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  thresholds: BrrrrThresholds,
  metrics: MetricResult[],
): BrrrrPerMetricUpgrade[] {
  const out: BrrrrPerMetricUpgrade[] = [];
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
  out.sort((a, b) => LETTER_RANK[a.currentGrade] - LETTER_RANK[b.currentGrade]);
  return out;
}
