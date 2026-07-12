/**
 * gradeFixAndFlipDeal — the public F&F grading orchestrator.
 *
 * Flow:
 *   1. Compute the 5 graded metrics (MAO margin, net profit %, CoC, annualized
 *      ROI, net profit $).
 *   2. Sum contribution → rawGpa, clamped [0, 4].
 *   3. Add strategy-aware market adjustment → finalGpa, clamped [0, 4].
 *   4. letterFromGpa → natural letter.
 *   5. Floors: net_profit_$ F caps at D; MAO F caps at C. (Caps lower the
 *      letter; never raise it.)
 *   6. Auto-kills: PROJECT_LOSS / PROFIT_BELOW_FLOOR / REHAB_UNVERIFIED_NO_
 *      CONTINGENCY / EXTREME_HOLD → force letter F.
 *   7. Build advisories and the user-facing summary string.
 */
import { clampGpa, letterFromGpa, marketAdjustment } from "../shared/aggregate";
import {
  LETTER_LABEL,
  LETTER_RANK,
  type DealGradingResult,
  type Letter,
  type MetricResult,
} from "../shared/types";
import {
  buildFlipAdvisories,
  buildFlipMetric,
  buildFlipSummary,
  collectFlipAutoKills,
  formatDollars,
  formatPercent,
} from "./grade-helpers";
import {
  annualizedROI,
  cashOnCashROI,
  purchaseMargin,
  netProfit,
  netProfitMargin,
} from "./metrics";
import { FIX_AND_FLIP_DEFAULTS } from "./thresholds";
import type {
  FixAndFlipContext,
  FixAndFlipInput,
  FixAndFlipThresholds,
} from "./types";

export function gradeFixAndFlipDeal(
  input: FixAndFlipInput,
  context: FixAndFlipContext = {},
  thresholds: FixAndFlipThresholds = FIX_AND_FLIP_DEFAULTS,
): DealGradingResult {
  if (input.price <= 0) {
    throw new Error("gradeFixAndFlipDeal: price must be a positive number");
  }
  if (input.arv <= 0) {
    throw new Error("gradeFixAndFlipDeal: arv must be a positive number");
  }

  // 1. Compute the 5 graded metric values.
  const purchaseMarginValue = purchaseMargin(input);
  const npm = netProfitMargin(input);
  const coc = cashOnCashROI(input);
  const annROI = annualizedROI(input);
  const npDollar = netProfit(input);

  const w = thresholds.weights;
  const metrics: MetricResult[] = [
    buildFlipMetric(
      "purchase_margin",
      "Purchase Margin (ARV)",
      purchaseMarginValue,
      formatPercent(purchaseMarginValue),
      thresholds.purchase_margin,
      w.purchase_margin,
    ),
    buildFlipMetric(
      "net_profit_margin",
      "Net Profit Margin",
      npm,
      formatPercent(npm),
      thresholds.net_profit_margin,
      w.net_profit_margin,
    ),
    buildFlipMetric(
      "cash_on_cash_roi",
      "Cash-on-Cash ROI",
      coc,
      formatPercent(coc),
      thresholds.cash_on_cash_roi,
      w.cash_on_cash_roi,
    ),
    buildFlipMetric(
      "annualized_roi",
      "Annualized ROI",
      annROI,
      formatPercent(annROI),
      thresholds.annualized_roi,
      w.annualized_roi,
    ),
    buildFlipMetric(
      "net_profit_dollar",
      "Net Profit ($)",
      npDollar,
      formatDollars(npDollar),
      thresholds.net_profit_dollar,
      w.net_profit_dollar,
    ),
  ];

  // 2 & 3. GPA roll-up + market adjustment.
  const rawGpa = clampGpa(metrics.reduce((sum, m) => sum + m.contribution, 0));
  const adjustment = marketAdjustment(context.marketPiqScore, "FIX_AND_FLIP");
  const finalGpa = clampGpa(rawGpa + adjustment);

  // 4. Natural letter from finalGpa.
  let letter: Letter = letterFromGpa(finalGpa);
  let flooredAt: Letter | undefined;

  // 5. Floors — only cap (lower) the letter, never raise it.
  const npDollarGrade = metrics.find(
    (m) => m.key === "net_profit_dollar",
  )?.grade;
  const purchaseMarginGrade = metrics.find(
    (m) => m.key === "purchase_margin",
  )?.grade;

  // net_profit_dollar F → cap at D
  if (npDollarGrade === "F" && LETTER_RANK[letter] > LETTER_RANK.D) {
    letter = "D";
    flooredAt = "D";
  }
  // purchase_margin F → cap at C (only if not already lower)
  if (purchaseMarginGrade === "F" && LETTER_RANK[letter] > LETTER_RANK.C) {
    letter = "C";
    flooredAt = "C";
  }

  // 6. Auto-kills always win — force letter to F.
  const autoKills = collectFlipAutoKills(input, context, thresholds.autoKills);
  if (autoKills.length > 0) {
    letter = "F";
  }

  // 7. Advisories + summary.
  const advisories = buildFlipAdvisories(input, context);
  const summary = buildFlipSummary(letter, metrics, autoKills);

  return {
    letter,
    label: LETTER_LABEL[letter],
    summary,
    rawGpa,
    marketAdjustment: adjustment,
    finalGpa,
    metrics,
    advisories,
    autoKills,
    flooredAt,
  };
}
