import type { FixAndFlipThresholds } from "./types";

/**
 * Default Fix & Flip rubric. Values calibrated to industry-standard guidance:
 *   - MAO compliance: positive margin against the 70%-rule is A; 33% margin
 *     means you bought meaningfully below MAO, which is the difference between
 *     a strong flip and a marginal one.
 *   - Net profit margin: 20%+ of ARV is institutional-grade; below 10% leaves
 *     no room for cost overruns.
 *   - Cash-on-cash: 30%+ is exceptional for a 4-6mo hold; 10% floor reflects
 *     opportunity cost of capital.
 *   - Annualized ROI: extrapolates CoC across the hold; a 60% annualized rate
 *     anchors the high bar.
 *   - Net profit $: dollars matter more than percentages on small deals; $10k
 *     net is the floor to make a flip worth the operational headache.
 *
 * Weights sum to 100. Annualized ROI is weighted slightly higher (25) because
 * it captures both margin AND velocity — the two real drivers of flip returns.
 */
export const FIX_AND_FLIP_DEFAULTS: FixAndFlipThresholds = {
  mao_compliance: {
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
  weights: {
    mao_compliance: 20,
    net_profit_margin: 20,
    cash_on_cash_roi: 20,
    annualized_roi: 25,
    net_profit_dollar: 15,
  },
};
