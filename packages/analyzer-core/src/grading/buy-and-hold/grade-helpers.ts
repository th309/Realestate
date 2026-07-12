// Private helpers for gradeBuyAndHoldDeal. Kept in a sibling file so grade.ts
// stays focused on orchestration and well under the 300-line logic-file limit.

import type { DealInput } from "../../types";
import { gpaPoints, gradeMetric } from "../shared/aggregate";
import type {
  AdvisoryResult,
  AutoKillFlag,
  Letter,
  MetricResult,
  MetricThreshold,
} from "../shared/types";
import { grm, opexRatio } from "./metrics";
import type { GradingContext } from "./types";
import {
  AUTOKILL_DEFAULTS,
  ruleEnabled,
  ruleValue,
  type BuyAndHoldAutoKillConfig,
} from "../shared/autokill-config";

export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

export function formatDscr(value: number): string {
  return value.toFixed(2);
}

export function formatDollars(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

export function buildMetric(
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

export function buildSummary(
  letter: Letter,
  metrics: MetricResult[],
  autoKills: AutoKillFlag[],
): string {
  const best = pickBest(metrics);
  const worst = pickWorst(metrics);
  switch (letter) {
    case "A":
      return `Strong buy — top-tier ${best.label} anchors a deal that hits every benchmark.`;
    case "B":
      return `Solid buy — ${best.label} leads, ${worst.label} is the watch-item.`;
    case "C":
      return `Marginal hold — ${worst.label} is dragging the otherwise-average deal.`;
    case "D":
      return `Likely avoid — ${worst.label} fails benchmark and floors the overall grade.`;
    case "F":
      if (autoKills.length > 0) {
        return `Strong avoid — ${autoKills[0].code} triggers an automatic disqualification.`;
      }
      return `Strong avoid — multiple metrics below threshold, including ${worst.label}.`;
  }
}

export function buildAdvisories(
  input: DealInput,
  onePctDecimal: number,
): AdvisoryResult[] {
  const onePctStatus: AdvisoryResult["status"] =
    onePctDecimal >= 0.01
      ? "pass"
      : onePctDecimal >= 0.007
        ? "marginal"
        : "fail";

  const grmValue = grm(input);
  const grmStatus: AdvisoryResult["status"] =
    grmValue < 10 ? "pass" : grmValue <= 14 ? "marginal" : "fail";

  const opexValue = opexRatio(input);
  const opexStatus: AdvisoryResult["status"] =
    opexValue < 0.5 ? "pass" : opexValue <= 0.6 ? "marginal" : "fail";

  return [
    {
      key: "one_percent_rule",
      label: "1% Rule",
      value: onePctDecimal,
      status: onePctStatus,
    },
    { key: "grm", label: "GRM", value: grmValue, status: grmStatus },
    {
      key: "opex_ratio",
      label: "OpEx Ratio",
      value: opexValue,
      status: opexStatus,
    },
  ];
}

/** "1.00" reads worse than the historical "1.0"; trim ONE trailing zero. */
function formatFloor(value: number): string {
  return value.toFixed(2).replace(/0$/, "");
}

export function collectAutoKills(
  input: DealInput,
  context: GradingContext,
  dscrValue: number,
  annualPretaxCashFlow: number,
  config?: BuyAndHoldAutoKillConfig,
): AutoKillFlag[] {
  const kills: AutoKillFlag[] = [];
  const D = AUTOKILL_DEFAULTS.BUY_AND_HOLD;

  const dscrFloor = ruleValue(config?.dscrFloor, D.dscrFloor);
  if (ruleEnabled(config?.dscrFloor) && dscrValue < dscrFloor) {
    kills.push({
      code: "DSCR_BELOW_1",
      message: `DSCR below ${formatFloor(dscrFloor)} — property cannot service its own debt.`,
    });
  }

  const zone = context.floodZone;
  if (
    ruleEnabled(config?.floodNoInsurance) &&
    (zone === "AE" || zone === "VE" || zone === "A") &&
    !context.floodInsuranceQuoted
  ) {
    kills.push({
      code: "FLOOD_NO_INSURANCE",
      message: `Property in flood zone ${zone} without quoted flood insurance.`,
    });
  }

  const rentMonthly = input.rentMonthly ?? 0;
  const taxIns = (input.taxAnnual ?? 0) + (input.insuranceAnnual ?? 0);
  const taxInsShare = ruleValue(config?.taxInsShareOfRent, D.taxInsShareOfRent);
  if (
    ruleEnabled(config?.taxInsShareOfRent) &&
    taxIns > taxInsShare * rentMonthly * 12
  ) {
    kills.push({
      code: "TAX_INS_OVER_40",
      message: `Taxes + insurance exceed ${Math.round(taxInsShare * 100)}% of gross annual rent.`,
    });
  }

  if (
    ruleEnabled(config?.negativeCashflowNoAck) &&
    annualPretaxCashFlow < 0 &&
    !context.appreciationPlayAccepted
  ) {
    kills.push({
      code: "NEG_CF_NO_APPRECIATION_ACK",
      message:
        "Negative pretax cash flow without an explicit appreciation-play acknowledgment.",
    });
  }

  return kills;
}
