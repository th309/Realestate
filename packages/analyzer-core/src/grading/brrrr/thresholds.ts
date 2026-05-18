import type { BrrrrThresholds } from "./types";

/**
 * Default BRRRR rubric.
 *
 *   - cash_left_in_deal:            lower is better — A=$0 means the deal
 *     fully recovered capital; D=$30k starts to look like a stuck flip.
 *   - all_in_to_arv_ratio:          lower is better — the canonical 75%-of-ARV
 *     rule; A at 70% is the textbook BRRRR target.
 *   - post_refi_dscr:               higher is better — lenders want ≥1.2 for
 *     conventional refi; A=1.4 gives 40% cushion.
 *   - post_refi_cash_flow_per_door: higher is better — $300/door/mo is the
 *     residential cash-flow benchmark; $0 is the survive-line at D.
 *   - time_to_refinance_months:     lower is better — 6 months is the
 *     seasoning sweet-spot (most lenders' minimum); 18+ is a stuck deal.
 *
 * Weights sum to 100. cash_left_in_deal carries the highest weight (25)
 * because capital recovery is the entire premise of BRRRR.
 */
export const BRRRR_DEFAULTS: BrrrrThresholds = {
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
  weights: {
    cash_left_in_deal: 25,
    all_in_to_arv_ratio: 20,
    post_refi_dscr: 20,
    post_refi_cash_flow_per_door: 20,
    time_to_refinance_months: 15,
  },
};
