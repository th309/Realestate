/**
 * Risk Flags Engine (Rule-Based)
 *
 * Pure function that computes risk flags for a market based on metric values,
 * national benchmarks, and geography data. Deterministic, no AI involved.
 *
 * Each metric is evaluated against predefined thresholds to produce risk flags
 * at three severity levels: high, medium, and low (geography-based).
 */

import { NationalBenchmarks } from '../market-intelligence.types';

export interface RiskFlag {
  /** Machine-readable flag name (e.g. 'population_decline', 'high_vacancy') */
  flag: string;
  /** Severity level of the risk */
  severity: 'high' | 'medium' | 'low';
  /** Human-readable description including the actual metric value */
  detail: string;
  /** The actual metric value that triggered this flag, or null for geo flags */
  metric_value: number | null;
  /** Human-readable threshold description for transparency */
  threshold: string;
}

export interface RiskMetrics {
  /** Population growth rate percentage */
  population_growth?: number | null;
  /** Year-over-year appreciation percentage */
  appreciation_yoy?: number | null;
  /** Vacancy rate percentage */
  vacancy_rate?: number | null;
  /** Unemployment rate percentage */
  unemployment_rate?: number | null;
  /** Year-over-year change in inventory percentage */
  inventory_yoy_change?: number | null;
  /** Year-over-year change in days on market percentage */
  dom_yoy_change?: number | null;
  /** Price-to-income ratio */
  price_to_income?: number | null;
  /** Year-over-year rent growth percentage */
  rent_growth_yoy?: number | null;
}

export interface GeoData {
  /** Whether the geography has coastal storm/hurricane risk */
  coastal_risk?: boolean;
  /** Whether the geography has wildfire risk */
  fire_risk?: boolean;
  /** Whether the geography has flood risk */
  flood_risk?: boolean;
}

interface MetricRiskRule {
  /** Machine-readable flag name */
  flagName: string;
  /** Severity of this risk */
  severity: 'high' | 'medium';
  /** The metric key this rule evaluates */
  metricKey: keyof RiskMetrics;
  /** Returns true if the metric value breaches the risk threshold */
  evaluate: (value: number, benchmarks: NationalBenchmarks) => boolean;
  /** Returns a human-readable threshold description */
  describeThreshold: (benchmarks: NationalBenchmarks) => string;
  /** Returns a human-readable detail string including the formatted value */
  describeDetail: (value: number, benchmarks: NationalBenchmarks) => string;
}

function formatToOneDecimal(value: number): string {
  return value.toFixed(1);
}

const METRIC_RISK_RULES: MetricRiskRule[] = [
  // --- HIGH severity ---
  {
    flagName: 'population_decline',
    severity: 'high',
    metricKey: 'population_growth',
    evaluate: (value) => value < -0.3,
    describeThreshold: () => 'population_growth < -0.3%',
    describeDetail: (value) =>
      `Population declining at ${formatToOneDecimal(value)}% annually`,
  },
  {
    flagName: 'price_decline',
    severity: 'high',
    metricKey: 'appreciation_yoy',
    evaluate: (value) => value < -2,
    describeThreshold: () => 'appreciation_yoy < -2%',
    describeDetail: (value) =>
      `Home prices declining at ${formatToOneDecimal(value)}% year-over-year`,
  },
  {
    flagName: 'high_vacancy',
    severity: 'high',
    metricKey: 'vacancy_rate',
    evaluate: (value, benchmarks) => value > benchmarks.vacancy_rate + 2,
    describeThreshold: (benchmarks) =>
      `vacancy_rate > national avg + 2% (${formatToOneDecimal(benchmarks.vacancy_rate + 2)}%)`,
    describeDetail: (value, benchmarks) =>
      `Vacancy rate at ${formatToOneDecimal(value)}%, significantly above national average of ${formatToOneDecimal(benchmarks.vacancy_rate)}%`,
  },
  {
    flagName: 'rising_unemployment',
    severity: 'high',
    metricKey: 'unemployment_rate',
    evaluate: (value, benchmarks) => value > benchmarks.unemployment_rate + 1.5,
    describeThreshold: (benchmarks) =>
      `unemployment_rate > national avg + 1.5% (${formatToOneDecimal(benchmarks.unemployment_rate + 1.5)}%)`,
    describeDetail: (value, benchmarks) =>
      `Unemployment at ${formatToOneDecimal(value)}%, well above national average of ${formatToOneDecimal(benchmarks.unemployment_rate)}%`,
  },

  // --- MEDIUM severity ---
  {
    flagName: 'inventory_surge',
    severity: 'medium',
    metricKey: 'inventory_yoy_change',
    evaluate: (value) => value > 20,
    describeThreshold: () => 'inventory_yoy_change > 20%',
    describeDetail: (value) =>
      `Housing inventory surging at ${formatToOneDecimal(value)}% year-over-year`,
  },
  {
    flagName: 'dom_increasing',
    severity: 'medium',
    metricKey: 'dom_yoy_change',
    evaluate: (value) => value > 15,
    describeThreshold: () => 'dom_yoy_change > 15%',
    describeDetail: (value) =>
      `Days on market increasing at ${formatToOneDecimal(value)}% year-over-year`,
  },
  {
    flagName: 'affordability_squeeze',
    severity: 'medium',
    metricKey: 'price_to_income',
    evaluate: (value) => value > 6,
    describeThreshold: () => 'price_to_income > 6.0',
    describeDetail: (value) =>
      `Price-to-income ratio at ${formatToOneDecimal(value)}, indicating affordability stress`,
  },
  {
    flagName: 'low_rent_growth',
    severity: 'medium',
    metricKey: 'rent_growth_yoy',
    evaluate: (value) => value < 0,
    describeThreshold: () => 'rent_growth_yoy < 0%',
    describeDetail: (value) =>
      `Rents declining at ${formatToOneDecimal(value)}% year-over-year`,
  },
];

interface GeoRiskRule {
  /** Machine-readable flag name */
  flagName: string;
  /** The geo data key this rule evaluates */
  geoKey: keyof GeoData;
  /** Human-readable detail for this geography risk */
  detail: string;
  /** Human-readable threshold description */
  threshold: string;
}

const GEO_RISK_RULES: GeoRiskRule[] = [
  {
    flagName: 'coastal_risk',
    geoKey: 'coastal_risk',
    detail: 'Geography is in a coastal zone with hurricane/storm exposure',
    threshold: 'coastal_risk = true',
  },
  {
    flagName: 'fire_risk',
    geoKey: 'fire_risk',
    detail: 'Geography is in a high wildfire risk zone',
    threshold: 'fire_risk = true',
  },
  {
    flagName: 'flood_risk',
    geoKey: 'flood_risk',
    detail: 'Geography is in a flood-prone zone',
    threshold: 'flood_risk = true',
  },
];

/** Compute risk flags from metric values and benchmarks. Pure and deterministic. */
export function computeRiskFlags(
  metrics: RiskMetrics,
  nationalBenchmarks: NationalBenchmarks,
  geoData: GeoData | null,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const rule of METRIC_RISK_RULES) {
    const metricValue = metrics[rule.metricKey];
    if (metricValue == null) continue;

    if (rule.evaluate(metricValue, nationalBenchmarks)) {
      flags.push({
        flag: rule.flagName,
        severity: rule.severity,
        detail: rule.describeDetail(metricValue, nationalBenchmarks),
        metric_value: metricValue,
        threshold: rule.describeThreshold(nationalBenchmarks),
      });
    }
  }

  if (geoData != null) {
    for (const rule of GEO_RISK_RULES) {
      if (geoData[rule.geoKey] === true) {
        flags.push({
          flag: rule.flagName,
          severity: 'low',
          detail: rule.detail,
          metric_value: null,
          threshold: rule.threshold,
        });
      }
    }
  }

  return flags;
}
