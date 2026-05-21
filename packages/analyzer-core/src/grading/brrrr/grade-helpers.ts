/**
 * Private helpers for gradeBrrrrDeal. Kept in a sibling file so grade.ts stays
 * focused on orchestration and well under the 300-line logic-file limit.
 *
 *   buildBrrrrMetric:     assemble one MetricResult (raw value → grade/contribution)
 *   formatPercent/Dollars/Months: presentation
 *   buildBrrrrAdvisories: rehab_contingency / refi_seasoning / post_refi_cap_rate
 *   collectBrrrrAutoKills: REFI_NOT_FINANCEABLE / NEGATIVE_POST_REFI_CASHFLOW /
 *                          REHAB_UNVERIFIED_NO_CONTINGENCY / CASH_LEFT_EXCEEDS_MAXIMUM
 *   buildBrrrrSummary:    letter-keyed one-sentence summary
 */
import { gpaPoints, gradeMetric } from "../shared/aggregate";
import type {
  AdvisoryResult,
  AutoKillFlag,
  Letter,
  MetricResult,
  MetricThreshold,
} from "../shared/types";
import {
  cashLeftInDeal,
  effectiveContingencyPct,
  postRefiCapRate,
  postRefiCashFlowMonthly,
  postRefiDSCR,
} from "./metrics";
import type { BrrrrContext, BrrrrGradingInput } from "./types";

const DEFAULT_MAX_CASH_TO_LEAVE = 10_000;

export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

export function formatRatio(value: number): string {
  if (!isFinite(value)) return "∞";
  return value.toFixed(2);
}

export function formatDollars(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

export function formatMonths(value: number): string {
  return `${value.toFixed(0)} mo`;
}

export function buildBrrrrMetric(
  key: string,
  label: string,
  value: number,
  formattedValue: string,
  threshold: MetricThreshold,
  weight: number,
): MetricResult {
  const grade = gradeMetric(value, threshold);
  const points = gpaPoints(grade);
  const contribution = (points * weight) / 100;
  return {
    key,
    label,
    value,
    formattedValue,
    grade,
    gpaPoints: points,
    weight,
    contribution,
    threshold,
  };
}

// ---- Auto-kills ------------------------------------------------------------

export function collectBrrrrAutoKills(
  input: BrrrrGradingInput,
  context: BrrrrContext,
): AutoKillFlag[] {
  const kills: AutoKillFlag[] = [];

  // REFI_NOT_FINANCEABLE — lenders cap conventional refi at DSCR ≥ 1.0 (some
  // even 1.1+). Below that, the refi simply doesn't close and BRRRR breaks.
  const dscr = postRefiDSCR(input);
  if (dscr < 1.0 && !context.negativeCashFlowAccepted) {
    kills.push({
      code: "REFI_NOT_FINANCEABLE",
      message: `Post-refi DSCR of ${formatRatio(dscr)} is below 1.0 — most lenders will not refinance this deal.`,
    });
  }

  // NEGATIVE_POST_REFI_CASHFLOW — even if the refi closes, bleeding cash month
  // after month makes the long-term hold untenable.
  const monthlyCF = postRefiCashFlowMonthly(input);
  if (monthlyCF < 0 && !context.negativeCashFlowAccepted) {
    kills.push({
      code: "NEGATIVE_POST_REFI_CASHFLOW",
      message: `Post-refi cash flow of ${formatDollars(monthlyCF)}/mo is negative — long-term hold is unsustainable.`,
    });
  }

  // REHAB_UNVERIFIED_NO_CONTINGENCY — BRRRR rehabs are heavier than F&F (full
  // gut, not paint-and-flooring), so contingency discipline matters MORE.
  if (
    context.rehabVerification === "estimate" &&
    effectiveContingencyPct(input) < 0.1 &&
    !context.rehabRiskAccepted
  ) {
    kills.push({
      code: "REHAB_UNVERIFIED_NO_CONTINGENCY",
      message:
        "Rehab is an estimate (not a contractor bid or itemized scope) and contingency is below 10% — high risk of cost overruns invalidating the refi appraisal.",
    });
  }

  // CASH_LEFT_EXCEEDS_MAXIMUM — capital trapping. Default $10k floor matches
  // the maximumCashToLeave context default.
  const left = cashLeftInDeal(input);
  const maxLeft = context.maximumCashToLeave ?? DEFAULT_MAX_CASH_TO_LEAVE;
  if (left > maxLeft && !context.capitalTrappingAccepted) {
    kills.push({
      code: "CASH_LEFT_EXCEEDS_MAXIMUM",
      message: `Cash left in deal (${formatDollars(left)}) exceeds the ${formatDollars(maxLeft)} maximum — capital recovery objective is missed.`,
    });
  }

  return kills;
}

// ---- Advisories ------------------------------------------------------------

export function buildBrrrrAdvisories(
  input: BrrrrGradingInput,
  context: BrrrrContext,
): AdvisoryResult[] {
  const advisories: AdvisoryResult[] = [];

  // Rehab contingency — same bands as F&F.
  const contingency = effectiveContingencyPct(input);
  advisories.push({
    key: "rehab_contingency",
    label: "Rehab Contingency",
    value: contingency,
    status:
      contingency >= 0.1 ? "pass" : contingency >= 0.05 ? "marginal" : "fail",
  });

  // Refi seasoning compliance — most conventional lenders require 6 months,
  // some 12. <6 mo is a strict-lender risk; >12 mo is just slow execution.
  const months = input.holdMonthsBeforeRefi;
  advisories.push({
    key: "refi_seasoning_compliance",
    label: "Refi Seasoning",
    value: months,
    status: months >= 6 ? "pass" : months >= 4 ? "marginal" : "fail",
  });

  // Post-refi cap rate — sanity check that the asset still cash-flows as a
  // rental even after the refi takes the cheap-acquisition advantage away.
  // 7%+ is healthy; 5-7% marginal; <5% means the deal lives on appreciation,
  // not cash flow.
  const cap = postRefiCapRate(input);
  advisories.push({
    key: "post_refi_cap_rate",
    label: "Post-Refi Cap Rate",
    value: cap,
    status: cap >= 0.07 ? "pass" : cap >= 0.05 ? "marginal" : "fail",
  });

  // Suppress unused-param lint when no advisories depend on context above.
  void context;

  return advisories;
}

// ---- Summary ---------------------------------------------------------------

function pickBest(metrics: MetricResult[]): MetricResult {
  let best = metrics[0];
  for (const m of metrics) {
    if (m.gpaPoints > best.gpaPoints) best = m;
  }
  return best;
}

function pickWorst(metrics: MetricResult[]): MetricResult {
  let worst = metrics[0];
  for (const m of metrics) {
    if (m.gpaPoints < worst.gpaPoints) worst = m;
  }
  return worst;
}

export function buildBrrrrSummary(
  letter: Letter,
  metrics: MetricResult[],
  autoKills: AutoKillFlag[],
): string {
  const best = pickBest(metrics);
  const worst = pickWorst(metrics);
  switch (letter) {
    case "A":
      return `Strong buy — ${best.label} leads a textbook BRRRR with full capital recovery.`;
    case "B":
      return `Buy — solid BRRRR mechanics, with ${worst.label} as the watch-item before close.`;
    case "C":
      return `Hold / reconsider — ${worst.label} drags the deal into marginal territory.`;
    case "D":
      return `Avoid — ${worst.label} fails benchmark and floors the overall grade.`;
    case "F":
      if (autoKills.length > 0) {
        return `Strong avoid — ${autoKills[0].code} triggers an automatic disqualification.`;
      }
      return `Strong avoid — multiple metrics below threshold, anchored by ${worst.label}.`;
  }
}
