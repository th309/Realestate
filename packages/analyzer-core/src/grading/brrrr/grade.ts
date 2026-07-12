/**
 * gradeBrrrrDeal — the public BRRRR grading orchestrator.
 *
 * Flow:
 *   1. Compute the 5 graded metrics (cash_left_in_deal, all_in_to_arv_ratio,
 *      post_refi_dscr, post_refi_cash_flow_per_door, time_to_refinance_months).
 *   2. Sum contribution → rawGpa, clamped [0, 4].
 *   3. Add BRRRR-aware market adjustment → finalGpa, clamped [0, 4].
 *   4. letterFromGpa → natural letter.
 *   5. Floors: cash_left_in_deal F caps at C; post_refi_dscr F caps at D.
 *      Both apply additively — if both metrics F, deal lands at D.
 *      (Caps lower the letter; never raise it.)
 *   6. Auto-kills: REFI_NOT_FINANCEABLE / NEGATIVE_POST_REFI_CASHFLOW /
 *      REHAB_UNVERIFIED_NO_CONTINGENCY / CASH_LEFT_EXCEEDS_MAXIMUM → force F.
 *   7. Build advisories and the user-facing summary string.
 *
 * Note on the 6-month seasoning question: per spec, refi-seasoning is an
 * ADVISORY, not an auto-kill. Even <6mo deals can still grade through (some
 * portfolio lenders / DSCR products will refi earlier with a hit on rate).
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
  buildBrrrrAdvisories,
  buildBrrrrMetric,
  buildBrrrrSummary,
  collectBrrrrAutoKills,
  formatDollars,
  formatMonths,
  formatPercent,
  formatRatio,
} from "./grade-helpers";
import {
  allInToARVRatio,
  cashLeftInDeal,
  postRefiCashFlowPerDoorMonthly,
  postRefiDSCR,
  timeToRefinanceMonths,
} from "./metrics";
import { BRRRR_DEFAULTS } from "./thresholds";
import type { BrrrrContext, BrrrrGradingInput, BrrrrThresholds } from "./types";

export function gradeBrrrrDeal(
  input: BrrrrGradingInput,
  context: BrrrrContext = {},
  thresholds: BrrrrThresholds = BRRRR_DEFAULTS,
): DealGradingResult {
  if (input.purchasePrice <= 0) {
    throw new Error("gradeBrrrrDeal: purchasePrice must be a positive number");
  }
  if (input.arv <= 0) {
    throw new Error("gradeBrrrrDeal: arv must be a positive number");
  }
  if (input.monthlyRent <= 0) {
    throw new Error("gradeBrrrrDeal: monthlyRent must be a positive number");
  }
  if (input.refiTermYears <= 0) {
    throw new Error("gradeBrrrrDeal: refiTermYears must be a positive number");
  }

  // 1. Compute the 5 graded metric values.
  const cashLeft = cashLeftInDeal(input);
  const allInRatio = allInToARVRatio(input);
  const dscr = postRefiDSCR(input);
  const cfPerDoor = postRefiCashFlowPerDoorMonthly(input);
  const ttr = timeToRefinanceMonths(input);

  const w = thresholds.weights;
  const metrics: MetricResult[] = [
    buildBrrrrMetric(
      "cash_left_in_deal",
      "Cash Left in Deal",
      cashLeft,
      formatDollars(cashLeft),
      thresholds.cash_left_in_deal,
      w.cash_left_in_deal,
    ),
    buildBrrrrMetric(
      "all_in_to_arv_ratio",
      "All-In to ARV",
      allInRatio,
      formatPercent(allInRatio),
      thresholds.all_in_to_arv_ratio,
      w.all_in_to_arv_ratio,
    ),
    buildBrrrrMetric(
      "post_refi_dscr",
      "Post-Refi DSCR",
      dscr,
      formatRatio(dscr),
      thresholds.post_refi_dscr,
      w.post_refi_dscr,
    ),
    buildBrrrrMetric(
      "post_refi_cash_flow_per_door",
      "Post-Refi Cash Flow / Door",
      cfPerDoor,
      formatDollars(cfPerDoor),
      thresholds.post_refi_cash_flow_per_door,
      w.post_refi_cash_flow_per_door,
    ),
    buildBrrrrMetric(
      "time_to_refinance_months",
      "Time to Refinance",
      ttr,
      formatMonths(ttr),
      thresholds.time_to_refinance_months,
      w.time_to_refinance_months,
    ),
  ];

  // 2 & 3. GPA roll-up + market adjustment.
  const rawGpa = clampGpa(metrics.reduce((sum, m) => sum + m.contribution, 0));
  const adjustment = marketAdjustment(context.marketPiqScore, "BRRRR");
  const finalGpa = clampGpa(rawGpa + adjustment);

  // 4. Natural letter from finalGpa.
  let letter: Letter = letterFromGpa(finalGpa);
  let flooredAt: Letter | undefined;

  // 5. Floors — only cap (lower) the letter, never raise it. Both floors can
  // apply additively: if both metrics F, post_refi_dscr drops to D, then
  // cash_left would try to cap at C — but C > D so it doesn't apply. The
  // worse cap wins, which means the order doesn't matter for correctness;
  // we apply them in spec order for clarity.
  const cashLeftGrade = metrics.find(
    (m) => m.key === "cash_left_in_deal",
  )?.grade;
  const dscrGrade = metrics.find((m) => m.key === "post_refi_dscr")?.grade;

  // cash_left_in_deal F → cap at C
  if (cashLeftGrade === "F" && LETTER_RANK[letter] > LETTER_RANK.C) {
    letter = "C";
    flooredAt = "C";
  }
  // post_refi_dscr F → cap at D (only if not already lower)
  if (dscrGrade === "F" && LETTER_RANK[letter] > LETTER_RANK.D) {
    letter = "D";
    flooredAt = "D";
  }

  // 6. Auto-kills always win — force letter to F.
  const autoKills = collectBrrrrAutoKills(input, context, thresholds.autoKills);
  if (autoKills.length > 0) {
    letter = "F";
  }

  // 7. Advisories + summary.
  const advisories = buildBrrrrAdvisories(input, context);
  const summary = buildBrrrrSummary(letter, metrics, autoKills);

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
