/**
 * Shared helpers for the Customize Thresholds drawer.
 *
 * - METRIC_ROWS: ordered metric metadata (label, suffix, formatter,
 *   inversion direction). Single source of truth so ThresholdsTab and
 *   the per-row "Reset" links agree on what the defaults are.
 * - presetForStrategy: maps Strategy → preset thresholds. Today all three
 *   strategies share the Balanced preset; if that ever forks, this is the
 *   only place to update.
 */

import {
  BALANCED_THRESHOLDS,
  type MetricThreshold,
  type Strategy,
  type UserThresholds,
} from "@propertyiq/analyzer-core";

export const ASSUMPTION_DEFAULTS = {
  vacancyPct: 0.05,
  maintenancePct: 0.05,
  capexPct: 0.05,
  pmPct: 0.08,
  rentGrowthPct: 0.03,
  appreciationPct: 0.03,
  holdYears: 10,
  closingCostsPct: 0.03,
} as const;

export type MetricKey =
  | "cashOnCash"
  | "dscr"
  | "cashFlowPerDoor"
  | "capRate"
  | "breakEvenOccupancy";

export interface MetricRowMeta {
  key: MetricKey;
  label: string;
  /** Suffix shown after each numeric input. */
  suffix: "%" | "$" | "";
  /** Convert stored value to the displayed number (decimal → percent etc.). */
  toDisplay: (raw: number) => number;
  /** Inverse — what the form yields back into stored shape. */
  fromDisplay: (displayed: number) => number;
  /** Pre-formatted preset string for the greyed "Default: …" hint. */
  formatPreset: (t: MetricThreshold) => string;
}

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
const fmtDollar = (n: number) => `$${Math.round(n)}`;
const fmtRatio = (n: number) => n.toFixed(2);

export const METRIC_ROWS: MetricRowMeta[] = [
  {
    key: "cashOnCash",
    label: "Cash-on-Cash",
    suffix: "%",
    toDisplay: (r) => Math.round(r * 1000) / 10, // 0.12 → 12.0
    fromDisplay: (d) => d / 100,
    formatPreset: (t) =>
      `A=${fmtPct(t.A)} B=${fmtPct(t.B)} C=${fmtPct(t.C)} D=${fmtPct(t.D)}`,
  },
  {
    key: "dscr",
    label: "DSCR",
    suffix: "",
    toDisplay: (r) => Math.round(r * 100) / 100,
    fromDisplay: (d) => d,
    formatPreset: (t) =>
      `A=${fmtRatio(t.A)} B=${fmtRatio(t.B)} C=${fmtRatio(t.C)} D=${fmtRatio(t.D)}`,
  },
  {
    key: "cashFlowPerDoor",
    label: "Cash Flow / Door",
    suffix: "$",
    toDisplay: (r) => r,
    fromDisplay: (d) => d,
    formatPreset: (t) =>
      `A=${fmtDollar(t.A)} B=${fmtDollar(t.B)} C=${fmtDollar(t.C)} D=${fmtDollar(t.D)}`,
  },
  {
    key: "capRate",
    label: "Cap Rate",
    suffix: "%",
    toDisplay: (r) => Math.round(r * 1000) / 10,
    fromDisplay: (d) => d / 100,
    formatPreset: (t) =>
      `A=${fmtPct(t.A)} B=${fmtPct(t.B)} C=${fmtPct(t.C)} D=${fmtPct(t.D)}`,
  },
  {
    key: "breakEvenOccupancy",
    label: "Break-Even Occupancy",
    suffix: "%",
    toDisplay: (r) => Math.round(r * 1000) / 10,
    fromDisplay: (d) => d / 100,
    formatPreset: (t) =>
      `A=${fmtPct(t.A)} B=${fmtPct(t.B)} C=${fmtPct(t.C)} D=${fmtPct(t.D)}`,
  },
];

/**
 * Strategy → preset. Today all three strategies fall back to Balanced; the
 * grading rubric isn't strategy-bifurcated. Kept as a function so we can
 * fork per-strategy later without rewriting call sites.
 */
export function presetForStrategy(_strategy: Strategy): UserThresholds {
  return BALANCED_THRESHOLDS;
}
