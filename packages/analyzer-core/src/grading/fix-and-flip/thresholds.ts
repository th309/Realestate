import type { FixAndFlipThresholds } from "./types";

/**
 * Fix & Flip grading presets — three risk profiles.
 *
 *   Conservative   Won't risk capital unless the win is obvious. High profit
 *                  floor, fat margins, slow-and-sure operator.
 *   Balanced       Standard institutional flip benchmarks.
 *   Aggressive     Velocity over margin. Experienced flipper with deal flow,
 *                  accepts smaller wins because they compound.
 *
 * Metric direction recap: all metrics are higher-is-better.
 *
 * Weights are shared across presets — annualized_roi keeps its 25% emphasis
 * because it captures the margin × velocity trade-off that defines flipping,
 * regardless of risk profile.
 */

const SHARED_WEIGHTS: FixAndFlipThresholds["weights"] = {
  purchase_margin: 20,
  net_profit_margin: 20,
  cash_on_cash_roi: 20,
  annualized_roi: 25,
  net_profit_dollar: 15,
};

export const FIX_AND_FLIP_CONSERVATIVE: FixAndFlipThresholds = {
  purchase_margin: {
    A: 0.38,
    B: 0.35,
    C: 0.3,
    D: 0.25,
    direction: "higher_is_better",
  },
  net_profit_margin: {
    A: 0.25,
    B: 0.2,
    C: 0.15,
    D: 0.1,
    direction: "higher_is_better",
  },
  cash_on_cash_roi: {
    A: 0.35,
    B: 0.28,
    C: 0.2,
    D: 0.15,
    direction: "higher_is_better",
  },
  annualized_roi: {
    A: 0.8,
    B: 0.6,
    C: 0.4,
    D: 0.25,
    direction: "higher_is_better",
  },
  net_profit_dollar: {
    A: 75_000,
    B: 50_000,
    C: 35_000,
    D: 20_000,
    direction: "higher_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const FIX_AND_FLIP_BALANCED: FixAndFlipThresholds = {
  purchase_margin: {
    A: 0.33,
    B: 0.3,
    C: 0.25,
    D: 0.2,
    direction: "higher_is_better",
  },
  net_profit_margin: {
    A: 0.2,
    B: 0.15,
    C: 0.1,
    D: 0.05,
    direction: "higher_is_better",
  },
  cash_on_cash_roi: {
    A: 0.3,
    B: 0.2,
    C: 0.15,
    D: 0.1,
    direction: "higher_is_better",
  },
  annualized_roi: {
    A: 0.6,
    B: 0.4,
    C: 0.25,
    D: 0.15,
    direction: "higher_is_better",
  },
  net_profit_dollar: {
    A: 50_000,
    B: 35_000,
    C: 20_000,
    D: 10_000,
    direction: "higher_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const FIX_AND_FLIP_AGGRESSIVE: FixAndFlipThresholds = {
  purchase_margin: {
    A: 0.28,
    B: 0.25,
    C: 0.2,
    D: 0.15,
    direction: "higher_is_better",
  },
  net_profit_margin: {
    A: 0.15,
    B: 0.12,
    C: 0.08,
    D: 0.04,
    direction: "higher_is_better",
  },
  cash_on_cash_roi: {
    A: 0.22,
    B: 0.18,
    C: 0.12,
    D: 0.08,
    direction: "higher_is_better",
  },
  annualized_roi: {
    A: 0.45,
    B: 0.3,
    C: 0.2,
    D: 0.1,
    direction: "higher_is_better",
  },
  net_profit_dollar: {
    A: 30_000,
    B: 20_000,
    C: 12_000,
    D: 5_000,
    direction: "higher_is_better",
  },
  weights: SHARED_WEIGHTS,
};

/** Default F&F rubric — aliased to FIX_AND_FLIP_BALANCED for back-compat. */
export const FIX_AND_FLIP_DEFAULTS: FixAndFlipThresholds =
  FIX_AND_FLIP_BALANCED;

export const FIX_AND_FLIP_PRESETS = {
  conservative: FIX_AND_FLIP_CONSERVATIVE,
  balanced: FIX_AND_FLIP_BALANCED,
  aggressive: FIX_AND_FLIP_AGGRESSIVE,
} as const;
