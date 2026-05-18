import type { BrrrrThresholds } from "./types";

/**
 * BRRRR grading presets — three risk profiles.
 *
 *   Conservative   Capital-recovery purist. Won't accept trapped equity, demands
 *                  lender cushion, expects fast seasoning.
 *   Balanced       Textbook BRRRR. Default for most operators.
 *   Aggressive     Appreciation-led play. Tolerates some trapped equity and
 *                  longer holds if cashflow + asset growth justify it.
 *
 * Metric direction recap:
 *   - cash_left_in_deal, all_in_to_arv_ratio, time_to_refinance_months: lower is better
 *   - post_refi_dscr, post_refi_cash_flow_per_door: higher is better
 *
 * Weights are shared across all three presets — the rubric's emphasis on
 * capital recovery (cash_left_in_deal at 25%) doesn't change between risk
 * profiles, only the bar for each grade does.
 */

const SHARED_WEIGHTS: BrrrrThresholds["weights"] = {
  cash_left_in_deal: 25,
  all_in_to_arv_ratio: 20,
  post_refi_dscr: 20,
  post_refi_cash_flow_per_door: 20,
  time_to_refinance_months: 15,
};

export const BRRRR_CONSERVATIVE: BrrrrThresholds = {
  cash_left_in_deal: {
    A: 0,
    B: 3_000,
    C: 10_000,
    D: 20_000,
    direction: "lower_is_better",
  },
  all_in_to_arv_ratio: {
    A: 0.65,
    B: 0.7,
    C: 0.75,
    D: 0.8,
    direction: "lower_is_better",
  },
  post_refi_dscr: {
    A: 1.55,
    B: 1.4,
    C: 1.3,
    D: 1.2,
    direction: "higher_is_better",
  },
  post_refi_cash_flow_per_door: {
    A: 400,
    B: 300,
    C: 200,
    D: 100,
    direction: "higher_is_better",
  },
  time_to_refinance_months: {
    A: 6,
    B: 8,
    C: 10,
    D: 14,
    direction: "lower_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const BRRRR_BALANCED: BrrrrThresholds = {
  cash_left_in_deal: {
    A: 0,
    B: 5_000,
    C: 15_000,
    D: 30_000,
    direction: "lower_is_better",
  },
  all_in_to_arv_ratio: {
    A: 0.7,
    B: 0.75,
    C: 0.8,
    D: 0.85,
    direction: "lower_is_better",
  },
  post_refi_dscr: {
    A: 1.4,
    B: 1.25,
    C: 1.15,
    D: 1.05,
    direction: "higher_is_better",
  },
  post_refi_cash_flow_per_door: {
    A: 300,
    B: 200,
    C: 100,
    D: 0,
    direction: "higher_is_better",
  },
  time_to_refinance_months: {
    A: 6,
    B: 9,
    C: 12,
    D: 18,
    direction: "lower_is_better",
  },
  weights: SHARED_WEIGHTS,
};

export const BRRRR_AGGRESSIVE: BrrrrThresholds = {
  cash_left_in_deal: {
    A: 10_000,
    B: 20_000,
    C: 35_000,
    D: 50_000,
    direction: "lower_is_better",
  },
  all_in_to_arv_ratio: {
    A: 0.75,
    B: 0.8,
    C: 0.85,
    D: 0.9,
    direction: "lower_is_better",
  },
  post_refi_dscr: {
    A: 1.25,
    B: 1.15,
    C: 1.05,
    D: 1.0,
    direction: "higher_is_better",
  },
  post_refi_cash_flow_per_door: {
    A: 200,
    B: 100,
    C: 50,
    D: 0,
    direction: "higher_is_better",
  },
  time_to_refinance_months: {
    A: 9,
    B: 12,
    C: 15,
    D: 24,
    direction: "lower_is_better",
  },
  weights: SHARED_WEIGHTS,
};

/** Default BRRRR rubric — aliased to BRRRR_BALANCED for back-compat. */
export const BRRRR_DEFAULTS: BrrrrThresholds = BRRRR_BALANCED;

export const BRRRR_PRESETS = {
  conservative: BRRRR_CONSERVATIVE,
  balanced: BRRRR_BALANCED,
  aggressive: BRRRR_AGGRESSIVE,
} as const;
