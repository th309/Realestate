/**
 * Private helpers for gradeFixAndFlipDeal. Kept in a sibling file so grade.ts
 * stays focused on orchestration and well under the 300-line logic-file limit.
 *
 *   buildFlipMetric:      assemble one MetricResult (raw value → grade/contribution)
 *   formatPercent/Dollars: presentation
 *   buildFlipAdvisories:  rehab contingency / hold-vs-DOM / financing-rate advisories
 *   collectFlipAutoKills: PROJECT_LOSS, PROFIT_BELOW_FLOOR, REHAB_UNVERIFIED, EXTREME_HOLD
 *   buildFlipSummary:     letter-keyed one-sentence summary
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
  effectiveFinancingType,
  effectiveHoldMonths,
  effectiveContingencyPct,
  netProfit,
} from "./metrics";
import type { FixAndFlipContext, FixAndFlipInput } from "./types";
import {
  AUTOKILL_DEFAULTS,
  ruleEnabled,
  ruleValue,
  type FixAndFlipAutoKillConfig,
} from "../shared/autokill-config";

const DEFAULT_MARKET_AVG_RATE_PCT = 7;

export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

export function formatDollars(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

export function buildFlipMetric(
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

export function collectFlipAutoKills(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  config?: FixAndFlipAutoKillConfig,
): AutoKillFlag[] {
  const kills: AutoKillFlag[] = [];
  const D = AUTOKILL_DEFAULTS.FIX_AND_FLIP;
  const profit = netProfit(input);
  // Config wins over the per-request context override, which wins over default.
  const minProfit = ruleValue(
    config?.minNetProfit,
    context.minimumNetProfit ?? D.minNetProfit,
  );

  if (ruleEnabled(config?.projectLoss) && profit < 0) {
    kills.push({
      code: "PROJECT_LOSS",
      message: `Projected net loss of ${formatDollars(profit)} — exit does not cover total project costs.`,
    });
  } else if (
    ruleEnabled(config?.minNetProfit) &&
    profit >= 0 &&
    profit < minProfit
  ) {
    kills.push({
      code: "PROFIT_BELOW_FLOOR",
      message: `Projected profit ${formatDollars(profit)} is below the ${formatDollars(minProfit)} minimum-profit floor.`,
    });
  }

  // Rehab unverified + insufficient contingency = high blow-up risk.
  const contingencyFloor = ruleValue(
    config?.rehabContingency,
    D.rehabContingency,
  );
  if (
    ruleEnabled(config?.rehabContingency) &&
    context.rehabVerification === "estimate" &&
    effectiveContingencyPct(input) < contingencyFloor &&
    !context.rehabRiskAccepted
  ) {
    kills.push({
      code: "REHAB_UNVERIFIED_NO_CONTINGENCY",
      message: `Rehab is an estimate (not a contractor bid or itemized scope) and contingency is below ${Math.round(contingencyFloor * 100)}% — high risk of cost overruns.`,
    });
  }

  // Hold materially longer than market DOM signals an illiquid exit.
  const domMultiple = ruleValue(config?.extremeHold, D.extremeHold);
  if (
    ruleEnabled(config?.extremeHold) &&
    context.marketDomDays != null &&
    !context.extendedHoldAccepted
  ) {
    const holdDays = effectiveHoldMonths(input) * 30;
    if (holdDays > context.marketDomDays * domMultiple) {
      kills.push({
        code: "EXTREME_HOLD",
        message: `Planned hold of ${Math.round(holdDays)} days is more than ${domMultiple}× market DOM (${context.marketDomDays}) — exit liquidity is suspect.`,
      });
    }
  }

  return kills;
}

// ---- Advisories ------------------------------------------------------------

export function buildFlipAdvisories(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
): AdvisoryResult[] {
  const advisories: AdvisoryResult[] = [];

  // Rehab contingency
  const contingency = effectiveContingencyPct(input);
  advisories.push({
    key: "rehab_contingency",
    label: "Rehab Contingency",
    value: contingency,
    status:
      contingency >= 0.1 ? "pass" : contingency >= 0.05 ? "marginal" : "fail",
  });

  // Hold vs. DOM
  if (context.marketDomDays != null) {
    const holdDays = effectiveHoldMonths(input) * 30;
    const ratio = holdDays / context.marketDomDays;
    advisories.push({
      key: "hold_vs_dom",
      label: "Hold vs. Market DOM",
      value: ratio,
      status: ratio <= 1 ? "pass" : ratio <= 1.5 ? "marginal" : "fail",
    });
  }

  // Financing rate (only when there IS a loan)
  if (effectiveFinancingType(input) !== "cash") {
    const marketRate = context.marketAvgRatePct ?? DEFAULT_MARKET_AVG_RATE_PCT;
    const rate = input.interestRatePct ?? 0;
    const spreadBps = (rate - marketRate) * 100; // pp → bps
    advisories.push({
      key: "financing_rate",
      label: "Financing Rate vs. Market",
      value: spreadBps,
      status:
        spreadBps <= 200 ? "pass" : spreadBps <= 400 ? "marginal" : "fail",
    });
  }

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

export function buildFlipSummary(
  letter: Letter,
  metrics: MetricResult[],
  autoKills: AutoKillFlag[],
): string {
  const best = pickBest(metrics);
  const worst = pickWorst(metrics);
  switch (letter) {
    case "A":
      return `Strong buy — ${best.label} leads a flip that clears every rubric line.`;
    case "B":
      return `Buy — solid margins, with ${worst.label} as the watch-item before close.`;
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
