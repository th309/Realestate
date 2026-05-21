import { piq } from "./piqTokens";

export type DataPoint = {
  x: number | string;
  /** Single-series y value. Optional because multi-series mode uses arbitrary keys via SeriesSpec. */
  y?: number;
  label?: string;
  /** Multi-series mode: each series consumes a named field on the data point. */
  [key: string]: number | string | undefined;
};

export type SeriesSpec = {
  /** Data field name on each DataPoint. */
  key: string;
  label: string;
  color: string;
  /** Whether this series is primary (drives headline + glow endpoint). Default: first series. */
  isPrimary?: boolean;
};

export type RangeOption = {
  label: string;
  /** Trailing data-point count to retain (e.g., 5 for "last 5 years" on yearly data, 60 for "last 5 years" on monthly data). */
  years: number;
};

export type HeadlineFormat = "currency" | "percent" | "number";

export const DEFAULT_RANGES: RangeOption[] = [
  { label: "1Y", years: 1 },
  { label: "5Y", years: 5 },
  { label: "10Y", years: 10 },
  { label: "30Y", years: 30 },
];

/**
 * Pick a directional color from data shape:
 *   - delta < 5% of starting value → indigo (flat)
 *   - ascending → green
 *   - descending → red
 */
export function autoColor(data: DataPoint[]): string {
  if (data.length < 2) return piq.indigo;
  // `y` is optional now (multi-series uses arbitrary keys). When single-series
  // callers populate `y`, this path returns directional; otherwise indigo.
  const first = data[0].y;
  const last = data[data.length - 1].y;
  if (typeof first !== "number" || typeof last !== "number") return piq.indigo;
  const diff = last - first;
  const denom = Math.max(Math.abs(first), 1);
  if (Math.abs(diff) / denom < 0.05) return piq.indigo;
  return diff > 0 ? piq.green : piq.red;
}

export type RangeAnchor = "head" | "tail";

/**
 * Slice the data to retain N trailing or leading points.
 *   - "tail" (default): last N — Robinhood-style historical chart behavior
 *   - "head": first N — forward projections where 5Y means "next 5 years"
 */
export function sliceToRange(
  data: DataPoint[],
  n: number,
  anchor: RangeAnchor = "tail",
): DataPoint[] {
  if (n >= data.length) return data;
  // Enforce a 2-point minimum so single-point ranges (e.g., 1Y on a yearly
  // forward projection) still render as a visible line + scrub target rather
  // than collapsing to a centered dot with no line.
  const effectiveN = Math.max(n, 2);
  return anchor === "head"
    ? data.slice(0, effectiveN)
    : data.slice(-effectiveN);
}

export function formatDeltaCompact(
  value: number,
  format: HeadlineFormat,
): string {
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (format === "currency") {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (format === "percent") return `${sign}${abs.toFixed(1)}%`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

export function arrowForDelta(value: number): string {
  if (value > 0) return "▲";
  if (value < 0) return "▼";
  return "▶";
}
