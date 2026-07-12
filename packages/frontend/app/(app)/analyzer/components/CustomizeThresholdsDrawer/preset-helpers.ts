/**
 * Strategy-aware helpers for the Customize Thresholds drawer.
 *
 * Three rubric shapes (B&H, F&F, BRRRR) — each with distinct metric keys,
 * thresholds, and weights — share one drawer. The drawer reads row metadata
 * (label, formatter, display unit) and presets from these maps keyed by
 * strategy, so the components themselves stay strategy-agnostic.
 *
 *   rowsForStrategy(strategy)            → MetricRowMeta[] for the active rubric
 *   presetForStrategy(strategy, name)    → threshold object for that preset
 *   weightKeysForStrategy(strategy)      → ordered metric keys for weight sum
 *   detectActivePreset(strategy, draft)  → which preset matches the draft, or null
 *
 * Back-compat: `METRIC_ROWS` and `MetricKey` are kept as B&H aliases so any
 * remaining unaudited callers keep compiling.
 */

import {
  BALANCED_THRESHOLDS,
  CONSERVATIVE_THRESHOLDS,
  AGGRESSIVE_THRESHOLDS,
  BRRRR_BALANCED,
  BRRRR_CONSERVATIVE,
  BRRRR_AGGRESSIVE,
  FIX_AND_FLIP_BALANCED,
  FIX_AND_FLIP_CONSERVATIVE,
  FIX_AND_FLIP_AGGRESSIVE,
  type BrrrrThresholds,
  type FixAndFlipThresholds,
  type GradingPresetName,
  type MetricThreshold,
  type Strategy,
  type UserThresholds,
} from "@propertyiq/analyzer-core";

export type AnyStrategyThresholds =
  | UserThresholds
  | FixAndFlipThresholds
  | BrrrrThresholds;

export const ASSUMPTION_DEFAULTS = {
  vacancyPct: 0.05,
  maintenancePct: 0.05,
  capexPct: 0.05,
  pmPct: 0.08,
  rentGrowthPct: 0.03,
  appreciationPct: 0.03,
  holdYears: 10,
  closingCostsPct: 0.03,
} as const;

/** B&H-only metric keys — retained for back-compat with tests and unaudited callers. */
export type MetricKey =
  | "cashOnCash"
  | "dscr"
  | "cashFlowPerDoor"
  | "capRate"
  | "breakEvenOccupancy";

export interface MetricRowMeta {
  /** Property name on the strategy's thresholds object. */
  key: string;
  /** Display label shown to the user. */
  label: string;
  /** Suffix shown after each numeric input. */
  suffix: "%" | "$" | "" | "mo";
  /** Convert stored value to the displayed number (decimal → percent etc.). */
  toDisplay: (raw: number) => number;
  /** Inverse — what the form yields back into stored shape. */
  fromDisplay: (displayed: number) => number;
  /** Pre-formatted preset string for the greyed "Default: …" hint. */
  formatPreset: (t: MetricThreshold) => string;
}

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
const fmtDollar = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtRatio = (n: number) => n.toFixed(2);
const fmtMonths = (n: number) => `${Math.round(n)}mo`;

const pctRow = (key: string, label: string): MetricRowMeta => ({
  key,
  label,
  suffix: "%",
  toDisplay: (r) => Math.round(r * 1000) / 10,
  fromDisplay: (d) => d / 100,
  formatPreset: (t) =>
    `A=${fmtPct(t.A)} B=${fmtPct(t.B)} C=${fmtPct(t.C)} D=${fmtPct(t.D)}`,
});

const dollarRow = (key: string, label: string): MetricRowMeta => ({
  key,
  label,
  suffix: "$",
  toDisplay: (r) => r,
  fromDisplay: (d) => d,
  formatPreset: (t) =>
    `A=${fmtDollar(t.A)} B=${fmtDollar(t.B)} C=${fmtDollar(t.C)} D=${fmtDollar(t.D)}`,
});

const ratioRow = (key: string, label: string): MetricRowMeta => ({
  key,
  label,
  suffix: "",
  toDisplay: (r) => Math.round(r * 100) / 100,
  fromDisplay: (d) => d,
  formatPreset: (t) =>
    `A=${fmtRatio(t.A)} B=${fmtRatio(t.B)} C=${fmtRatio(t.C)} D=${fmtRatio(t.D)}`,
});

const monthsRow = (key: string, label: string): MetricRowMeta => ({
  key,
  label,
  suffix: "mo",
  toDisplay: (r) => r,
  fromDisplay: (d) => d,
  formatPreset: (t) =>
    `A=${fmtMonths(t.A)} B=${fmtMonths(t.B)} C=${fmtMonths(t.C)} D=${fmtMonths(t.D)}`,
});

const BH_ROWS: MetricRowMeta[] = [
  pctRow("cashOnCash", "Cash-on-Cash"),
  ratioRow("dscr", "DSCR"),
  dollarRow("cashFlowPerDoor", "Cash Flow / Door"),
  pctRow("capRate", "Cap Rate"),
  pctRow("breakEvenOccupancy", "Break-Even Occupancy"),
];

const FF_ROWS: MetricRowMeta[] = [
  pctRow("purchase_margin", "Purchase Margin (ARV)"),
  pctRow("net_profit_margin", "Net Profit Margin"),
  pctRow("cash_on_cash_roi", "Cash-on-Cash ROI"),
  pctRow("annualized_roi", "Annualized ROI"),
  dollarRow("net_profit_dollar", "Net Profit $"),
];

const BRRRR_ROWS: MetricRowMeta[] = [
  dollarRow("cash_left_in_deal", "Cash Left in Deal"),
  pctRow("all_in_to_arv_ratio", "All-In to ARV"),
  ratioRow("post_refi_dscr", "Post-Refi DSCR"),
  dollarRow("post_refi_cash_flow_per_door", "Post-Refi CF / Door"),
  monthsRow("time_to_refinance_months", "Time to Refinance"),
];

const METRIC_ROWS_BY_STRATEGY: Record<Strategy, MetricRowMeta[]> = {
  BUY_AND_HOLD: BH_ROWS,
  FIX_AND_FLIP: FF_ROWS,
  BRRRR: BRRRR_ROWS,
};

const PRESETS_BY_STRATEGY: Record<
  Strategy,
  Record<GradingPresetName, AnyStrategyThresholds>
> = {
  BUY_AND_HOLD: {
    conservative: CONSERVATIVE_THRESHOLDS,
    balanced: BALANCED_THRESHOLDS,
    aggressive: AGGRESSIVE_THRESHOLDS,
  },
  FIX_AND_FLIP: {
    conservative: FIX_AND_FLIP_CONSERVATIVE,
    balanced: FIX_AND_FLIP_BALANCED,
    aggressive: FIX_AND_FLIP_AGGRESSIVE,
  },
  BRRRR: {
    conservative: BRRRR_CONSERVATIVE,
    balanced: BRRRR_BALANCED,
    aggressive: BRRRR_AGGRESSIVE,
  },
};

export function rowsForStrategy(strategy: Strategy): MetricRowMeta[] {
  return METRIC_ROWS_BY_STRATEGY[strategy] ?? BH_ROWS;
}

export function presetForStrategy(
  strategy: Strategy,
  preset: GradingPresetName = "balanced",
): AnyStrategyThresholds {
  return PRESETS_BY_STRATEGY[strategy]?.[preset] ?? BALANCED_THRESHOLDS;
}

export function weightKeysForStrategy(strategy: Strategy): string[] {
  return rowsForStrategy(strategy).map((r) => r.key);
}

/**
 * Heuristic preset detection: does this thresholds object exactly match one of
 * the three named presets for the strategy? Returns null when the user has
 * customized any value off the preset grid.
 */
export function detectActivePreset(
  strategy: Strategy,
  current: AnyStrategyThresholds | null | undefined,
): GradingPresetName | null {
  if (!current) return null;
  const presets = PRESETS_BY_STRATEGY[strategy];
  if (!presets) return null;
  // autoKills is orthogonal to presets — ignore it for matching.
  const { autoKills: _ignored, ...rubric } =
    current as AnyStrategyThresholds & {
      autoKills?: unknown;
    };
  const keys: GradingPresetName[] = ["conservative", "balanced", "aggressive"];
  const currentJson = JSON.stringify(rubric);
  for (const name of keys) {
    if (JSON.stringify(presets[name]) === currentJson) return name;
  }
  return null;
}

/** Back-compat export for the original B&H-only METRIC_ROWS consumer. */
export const METRIC_ROWS: MetricRowMeta[] = BH_ROWS;
