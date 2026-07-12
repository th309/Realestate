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

/**
 * Fractional position of y=0 from the TOP of the plotted value range, for a
 * hard-stop SVG gradient that renders values above zero in the series color
 * and values below zero in red. Returns null when the data doesn't cross
 * zero (no gradient needed — a flat color is correct).
 */
export function zeroCrossingOffset(
  data: DataPoint[],
  key: string,
): number | null {
  const values = data
    .map((p) => p[key])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (min >= 0 || max <= 0) return null;
  return max / (max - min);
}

/**
 * Resolve the primary series' stroke/fill under optional sign coloring:
 * data crossing zero paints via a hard-stop gradient (url ref), all-negative
 * data is plain red, otherwise the base series color.
 */
export function resolveSignPaint(
  data: DataPoint[],
  key: string,
  baseColor: string,
  gradientId: string,
  signColoring: boolean,
): { color: string; paint: string; zeroOffset: number | null } {
  const zeroOffset = signColoring ? zeroCrossingOffset(data, key) : null;
  const allNegative =
    signColoring &&
    data.length > 0 &&
    data.every((p) => {
      const v = p[key];
      return typeof v === "number" && v <= 0;
    });
  const color = allNegative ? piq.red : baseColor;
  return {
    color,
    paint: zeroOffset != null ? `url(#${gradientId})` : color,
    zeroOffset,
  };
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

/**
 * Compact, sign-aware value formatter shared by the headline, axis ticks, and
 * the per-line scrub labels so every number on the chart reads identically
 * ("$599K", "−$593K", "12.3%"). Unlike `formatDeltaCompact` it does NOT prefix
 * positives with "+".
 */
export function compactValue(value: number, format: HeadlineFormat): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (format === "currency") {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${Math.round(abs)}`;
  }
  if (format === "percent") return `${sign}${abs.toFixed(1)}%`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

/**
 * Y-axis tick label. Identical to `compactValue` for normal ranges, but when the
 * plotted value span is narrow (sub-$20K currency), it switches to one-decimal
 * "$48.2K" precision so adjacent ticks don't collapse to the same rounded label
 * (e.g. two gridlines both reading "$48K"). Wide-range charts are unaffected.
 */
export function formatYTick(
  value: number,
  format: HeadlineFormat,
  span: number,
): string {
  if (
    format === "currency" &&
    Number.isFinite(value) &&
    value !== 0 &&
    span > 0 &&
    span < 20_000
  ) {
    const sign = value < 0 ? "−" : "";
    return `${sign}$${(Math.abs(value) / 1000).toFixed(1)}K`;
  }
  return compactValue(value, format);
}

/**
 * Pick up to `maxTicks` evenly-spaced x values from the (already range-sliced)
 * data, always including the first and last point. Returns the actual x values
 * present in the data so axis ticks land on real data points. Numeric x only —
 * category axes let Recharts choose. Because it reads the sliced data, the tick
 * set automatically re-densifies when the range pill (1Y/5Y/10Y/30Y) changes.
 */
export function computeAxisTicks(data: DataPoint[], maxTicks = 6): number[] {
  const xs = data
    .map((d) => d.x)
    .filter((x): x is number => typeof x === "number");
  if (xs.length <= maxTicks) return xs;
  const step = Math.ceil((xs.length - 1) / (maxTicks - 1));
  const ticks: number[] = [];
  for (let i = 0; i < xs.length; i += step) ticks.push(xs[i]);
  const lastX = xs[xs.length - 1];
  if (ticks[ticks.length - 1] !== lastX) ticks.push(lastX);
  return ticks;
}
