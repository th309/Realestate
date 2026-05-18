/**
 * Per-metric upgrade orchestrator for Fix & Flip. For each non-A metric,
 * find smallest single-lever moves that lift THAT metric to its next tier.
 *
 * F&F lever effects are mostly aligned across metrics (lower price/rehab,
 * higher ARV all help every metric) but holdMonths and financingRate are
 * only relevant for return metrics (profit margin, ROI), not the pure
 * acquisition ratios.
 */
import type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./types";
import {
  FEASIBILITY_RANK,
  FLIP_LEVER_BOUNDS,
  FLIP_LEVER_LABEL,
  feasibilityFor,
  formatDeltaFor,
  type FlipPerMetricUpgrade,
  type FlipUpgradeLever,
  type FlipUpgradeOption,
} from "./upgrade-path-helpers";
import { findSmallestMoveForMetric } from "./per-metric-search";
import { LETTER_RANK, type Letter, type MetricResult } from "../shared/types";

const LETTER_ORDER: Letter[] = ["F", "D", "C", "B", "A"];

function nextTierAbove(current: Letter): Letter | null {
  const idx = LETTER_ORDER.indexOf(current);
  if (idx < 0 || idx >= LETTER_ORDER.length - 1) return null;
  return LETTER_ORDER[idx + 1];
}

interface FlipLeverConfig {
  lever: FlipUpgradeLever;
  currentFor: (i: FixAndFlipInput) => number;
  boundFor: (i: FixAndFlipInput) => number | null;
}

const PURCHASE_DOWN: FlipLeverConfig = {
  lever: "purchasePrice",
  currentFor: (i) => i.price,
  boundFor: (i) =>
    i.price > 0 ? i.price * FLIP_LEVER_BOUNDS.purchasePrice.multiplier : null,
};

const REHAB_DOWN: FlipLeverConfig = {
  lever: "rehabCost",
  currentFor: (i) => i.rehabBudget,
  boundFor: (i) =>
    i.rehabBudget > 0
      ? i.rehabBudget * FLIP_LEVER_BOUNDS.rehabCost.multiplier
      : null,
};

const ARV_UP: FlipLeverConfig = {
  lever: "arv",
  currentFor: (i) => i.arv,
  boundFor: (i) =>
    i.arv > 0 ? i.arv * FLIP_LEVER_BOUNDS.arv.multiplier : null,
};

const HOLD_DOWN: FlipLeverConfig = {
  lever: "holdMonths",
  currentFor: (i) => i.holdMonths ?? i.holdingMonths ?? 6,
  boundFor: (i) => {
    const current = i.holdMonths ?? i.holdingMonths ?? 6;
    return Math.max(1, current - FLIP_LEVER_BOUNDS.holdMonths.monthsDelta);
  },
};

const RATE_DOWN: FlipLeverConfig = {
  lever: "financingRate",
  currentFor: (i) => i.interestRatePct ?? 0,
  boundFor: (i) => {
    const type = i.financingType ?? "cash";
    const rate = i.interestRatePct ?? 0;
    if (type === "cash" || rate <= 0) return null;
    return Math.max(0, rate - FLIP_LEVER_BOUNDS.financingRate.rateDelta);
  },
};

/**
 * Per-metric lever applicability.
 *
 * mao_compliance = (ARV - rehabAdj - price) / ARV — acquisition-only ratio.
 *   Levers: price ↓, rehab ↓, ARV ↑. Hold/rate don't move it.
 * net_profit_margin / cash_on_cash_roi / annualized_roi / net_profit_dollar
 *   are all return metrics — all 5 levers help (lower price/rehab, higher
 *   ARV, shorter hold, lower rate).
 */
const LEVER_MAP: Record<string, FlipLeverConfig[]> = {
  mao_compliance: [PURCHASE_DOWN, REHAB_DOWN, ARV_UP],
  net_profit_margin: [PURCHASE_DOWN, REHAB_DOWN, ARV_UP, HOLD_DOWN, RATE_DOWN],
  cash_on_cash_roi: [PURCHASE_DOWN, REHAB_DOWN, ARV_UP, HOLD_DOWN, RATE_DOWN],
  annualized_roi: [PURCHASE_DOWN, REHAB_DOWN, ARV_UP, HOLD_DOWN, RATE_DOWN],
  net_profit_dollar: [PURCHASE_DOWN, REHAB_DOWN, ARV_UP, HOLD_DOWN, RATE_DOWN],
};

function leverOptionsForMetric(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  metric: MetricResult,
  targetGrade: Letter,
): FlipUpgradeOption[] {
  const configs = LEVER_MAP[metric.key] ?? [];
  const options: FlipUpgradeOption[] = [];
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
      label: FLIP_LEVER_LABEL[cfg.lever],
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

export function computeFlipPerMetricUpgrade(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  thresholds: FixAndFlipThresholds,
  metrics: MetricResult[],
): FlipPerMetricUpgrade[] {
  const out: FlipPerMetricUpgrade[] = [];
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
