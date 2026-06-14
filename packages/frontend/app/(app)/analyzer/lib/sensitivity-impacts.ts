import type {
  DealInput,
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import type { Strategy } from "./strategy-tile-mappers";
import type { SecondaryTile } from "./strategy-secondary-mappers";
import { computeImpactForMetric } from "./sensitivity-formulas";

/**
 * Public types + API for sensitivity analysis. Internal first-order math lives
 * in `sensitivity-formulas.ts` (split for file-size budget).
 */

export type SensitivityVariable =
  | "rate"
  | "rent"
  | "vacancy"
  | "taxes"
  | "insurance"
  | "exitCap";

export interface VariableMove {
  label: string;
  unit: string;
  perUnit: "pp" | "%";
  delta: number;
}

export const VARIABLE_MOVES: Record<SensitivityVariable, VariableMove> = {
  rate: { label: "Interest rate", unit: "±1pp", perUnit: "pp", delta: 0.01 },
  rent: { label: "Rent", unit: "±5%", perUnit: "%", delta: 0.05 },
  vacancy: { label: "Vacancy", unit: "±3pp", perUnit: "pp", delta: 0.03 },
  taxes: { label: "Taxes", unit: "±10%", perUnit: "%", delta: 0.1 },
  insurance: { label: "Insurance", unit: "±20%", perUnit: "%", delta: 0.2 },
  exitCap: { label: "Exit cap", unit: "±0.5pp", perUnit: "pp", delta: 0.005 },
};

const VARIABLE_ORDER: SensitivityVariable[] = [
  "rate",
  "rent",
  "vacancy",
  "taxes",
  "insurance",
  "exitCap",
];

export type MetricFormat = "currency" | "percent" | "ratio";

export type MetricKey =
  | "monthlyCashflow"
  | "coc"
  | "cap"
  | "dscr"
  | "noi"
  | "netProfit"
  | "roi"
  | "annualizedRoi"
  | "mao"
  | "capitalLeft"
  | "cashRecovery"
  | "postRefiCashflow"
  | "cocOnRemaining";

export interface MetricSpec {
  key: MetricKey;
  label: string;
  format: MetricFormat;
}

export const STRATEGY_METRICS: Record<Strategy, MetricSpec[]> = {
  buyAndHold: [
    { key: "monthlyCashflow", label: "Monthly cash flow", format: "currency" },
    { key: "coc", label: "Cash-on-cash", format: "percent" },
    { key: "cap", label: "Cap rate", format: "percent" },
    { key: "dscr", label: "DSCR", format: "ratio" },
  ],
  flip: [
    { key: "netProfit", label: "Net profit", format: "currency" },
    { key: "roi", label: "ROI", format: "percent" },
    { key: "annualizedRoi", label: "Annualized ROI", format: "percent" },
    { key: "mao", label: "MAO / 70% rule", format: "currency" },
  ],
  brrrr: [
    { key: "capitalLeft", label: "Capital left", format: "currency" },
    { key: "cashRecovery", label: "Cash recovery", format: "percent" },
    {
      key: "postRefiCashflow",
      label: "Post-refi cash flow",
      format: "currency",
    },
    { key: "cocOnRemaining", label: "CoC on remaining", format: "percent" },
  ],
  multifamily: [
    { key: "noi", label: "NOI (annual)", format: "currency" },
    { key: "cap", label: "Cap rate", format: "percent" },
    { key: "dscr", label: "DSCR", format: "ratio" },
    { key: "coc", label: "Cash-on-cash", format: "percent" },
  ],
};

export interface ImpactInputs {
  input: DealInput;
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
  arv: number;
  rehabBudget?: number;
  strategy: Strategy;
  metric: MetricKey;
}

export interface VariableImpact {
  variable: SensitivityVariable;
  label: string;
  unit: string;
  /** Absolute swing in the chosen metric (units: $, %, or ratio per metric.format). */
  magnitude: number;
}

export function computeImpacts(opts: ImpactInputs): VariableImpact[] {
  return VARIABLE_ORDER.map((v) => ({
    variable: v,
    label: VARIABLE_MOVES[v].label,
    unit: VARIABLE_MOVES[v].unit,
    magnitude: Math.abs(computeImpactForMetric(v, opts)),
  })).sort((a, b) => b.magnitude - a.magnitude);
}

function elasticityPerUnit(
  variable: SensitivityVariable,
  magnitude: number,
): number {
  const move = VARIABLE_MOVES[variable];
  // Convert delta from decimal (0.01 = 1pp/1%) to display units (× 100).
  return magnitude / (move.delta * 100);
}

export function computeElasticityMetrics(
  impacts: VariableImpact[],
  metricFormat: MetricFormat,
): SecondaryTile[] {
  return impacts.map((impact) => {
    const move = VARIABLE_MOVES[impact.variable];
    const elasticity = elasticityPerUnit(impact.variable, impact.magnitude);
    return {
      label: `${impact.label} (per 1${move.perUnit})`,
      value: elasticity,
      format:
        metricFormat === "currency"
          ? "currency"
          : metricFormat === "ratio"
            ? "ratio"
            : "percent",
    };
  });
}

export type ConfidenceTier = "high" | "medium" | "low";

export interface ConfidenceResult {
  tier: ConfidenceTier;
  description: string;
}

export function computeConfidence(
  comps: Array<{ distance?: number }>,
): ConfidenceResult {
  const within05 = comps.filter((c) => (c.distance ?? Infinity) <= 0.5).length;
  const within1 = comps.filter((c) => (c.distance ?? Infinity) <= 1).length;
  if (within05 >= 5) {
    return { tier: "high", description: `${within05} comps within 0.5mi` };
  }
  if (within1 >= 3) {
    return { tier: "medium", description: `${within1} comps within 1mi` };
  }
  return {
    tier: "low",
    description:
      comps.length === 0
        ? "No comp data available"
        : `Only ${comps.length} comp${comps.length === 1 ? "" : "s"} available`,
  };
}
