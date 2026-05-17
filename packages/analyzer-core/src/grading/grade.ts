import { computeRentalMetrics } from "../rental";
import type { DealInput } from "../types";
import { clampGpa, letterFromGpa, marketAdjustment } from "./aggregate";
import {
  LETTER_LABEL,
  LETTER_RANK,
  buildAdvisories,
  buildMetric,
  buildSummary,
  collectAutoKills,
  formatDollars,
  formatDscr,
  formatPercent,
} from "./grade-helpers";
import { breakEvenOccupancy, cashFlowPerDoor } from "./metrics";
import { BUY_AND_HOLD_DEFAULTS } from "./thresholds";
import type {
  DealGradingResult,
  GradingContext,
  Letter,
  MetricResult,
  UserThresholds,
} from "./types";

export function gradeDeal(
  input: DealInput,
  context: GradingContext = {},
  thresholds: UserThresholds = BUY_AND_HOLD_DEFAULTS,
): DealGradingResult {
  if (input.rentMonthly == null || input.rentMonthly <= 0) {
    throw new Error("gradeDeal: rentMonthly must be a positive number");
  }
  if (input.price <= 0) {
    throw new Error("gradeDeal: price must be a positive number");
  }

  const rental = computeRentalMetrics(input);

  // RentalResult percent fields are non-null here because rentMonthly > 0 and
  // price > 0 (validated above). Convert PERCENT → DECIMAL for grading.
  const cashOnCashDecimal = (rental.cashOnCashPct ?? 0) / 100;
  const capRateDecimal = (rental.capRatePct ?? 0) / 100;
  const dscrValue = rental.dscr ?? 0;
  const annualDebtService = rental.monthlyDebtService * 12;
  const annualPretaxCashFlow = (rental.cashflowMonthly ?? 0) * 12;
  const cfPerDoor = cashFlowPerDoor(annualPretaxCashFlow, input.unitCount ?? 1);
  const beOccupancy = breakEvenOccupancy(input, annualDebtService);
  const onePctDecimal = (rental.onePctRulePct ?? 0) / 100;

  const w = thresholds.weights;
  const metrics: MetricResult[] = [
    buildMetric(
      "cashOnCash",
      "Cash-on-Cash",
      cashOnCashDecimal,
      formatPercent(cashOnCashDecimal),
      thresholds.cashOnCash,
      w.cashOnCash,
    ),
    buildMetric(
      "dscr",
      "DSCR",
      dscrValue,
      formatDscr(dscrValue),
      thresholds.dscr,
      w.dscr,
    ),
    buildMetric(
      "cashFlowPerDoor",
      "Cash Flow per Door",
      cfPerDoor,
      formatDollars(cfPerDoor),
      thresholds.cashFlowPerDoor,
      w.cashFlowPerDoor,
    ),
    buildMetric(
      "capRate",
      "Cap Rate",
      capRateDecimal,
      formatPercent(capRateDecimal),
      thresholds.capRate,
      w.capRate,
    ),
    buildMetric(
      "breakEvenOccupancy",
      "Break-Even Occupancy",
      beOccupancy,
      formatPercent(beOccupancy),
      thresholds.breakEvenOccupancy,
      w.breakEvenOccupancy,
    ),
  ];

  const rawGpa = clampGpa(metrics.reduce((sum, m) => sum + m.contribution, 0));
  const adjustment = marketAdjustment(context.marketPiqScore);
  const finalGpa = clampGpa(rawGpa + adjustment);

  let letter: Letter = letterFromGpa(finalGpa);
  let flooredAt: Letter | undefined;

  // Floor: a failing CoC or DSCR caps the overall letter at D. Without this,
  // a deal could score B/C overall despite failing a make-or-break metric.
  const cocGrade = metrics.find((m) => m.key === "cashOnCash")?.grade;
  const dscrGrade = metrics.find((m) => m.key === "dscr")?.grade;
  if (
    (cocGrade === "F" || dscrGrade === "F") &&
    LETTER_RANK[letter] > LETTER_RANK.D
  ) {
    letter = "D";
    flooredAt = "D";
  }

  const autoKills = collectAutoKills(
    input,
    context,
    dscrValue,
    annualPretaxCashFlow,
  );
  if (autoKills.length > 0) {
    letter = "F";
  }

  const advisories = buildAdvisories(input, onePctDecimal);
  const summary = buildSummary(letter, metrics, autoKills);

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
