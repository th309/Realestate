import type { ExplorerFormat } from "./explorer-config";

export function makeLogScale(min: number, max: number): (v: number) => number {
  const lo = Math.log(Math.max(1, min)),
    hi = Math.log(Math.max(min + 1, max));
  return (v: number) =>
    (Math.log(Math.min(max, Math.max(min, v))) - lo) / (hi - lo);
}

export function niceBubbleBounds(prices: number[]): [number, number] {
  const valid = prices.filter((p) => p > 0);
  if (!valid.length) return [1, 10];
  return [Math.max(1, Math.min(...valid) * 0.8), Math.max(...valid) * 1.15];
}

/**
 * Dynamic bounds per format (CLAUDE.md §1.1/§6 — never hardcode breakpoints):
 * percent/percent_abs use the 5th-95th percentile (a few outlier metros
 * shouldn't wash out the whole gradient); index uses the true min-max (PIQ
 * score/hotness are already bounded 1-99); days/months use min-95th (a long
 * tail of slow markets shouldn't compress the rest). `sortedValues` must
 * already be sorted ascending and non-empty.
 */
function percentileBounds(
  sortedValues: number[],
  format: ExplorerFormat,
): [number, number] {
  const n = sortedValues.length;
  const at = (p: number) =>
    sortedValues[Math.min(n - 1, Math.round(p * (n - 1)))];
  const lo =
    format === "percent" || format === "percent_abs"
      ? at(0.05)
      : sortedValues[0];
  const hi = format === "index" ? sortedValues[n - 1] : at(0.95);
  return [lo, hi];
}

/**
 * Maps each region's raw value for the CURRENTLY selected metric onto a
 * 0-100 scalar for `getScoreColor`, so the map/bubble color always reflects
 * whatever metric is active — not a frozen, unrelated dimension.
 *
 * Bounds default to being computed from `valueByRegion` itself (see
 * `percentileBounds`), but a caller animating between two snapshots (see
 * `AnimatedHeroChart`) MUST pass `precomputedBounds` computed once across the
 * metric's FULL history — recomputing bounds fresh from just the current
 * blended frame makes the whole color scale visibly rescale every tick (on
 * top of, and easily mistaken for, the individual regions' own color
 * changing), exactly the "GLOBAL scales across ALL frames so axes stay
 * fixed... only dots move, not the grid/axes" requirement the graphs page's
 * D3 scatter race calls out for the same reason.
 *
 * Direction is flipped for "lower is better" metrics (days on market, months
 * of supply) so green always means "good", not "numerically high".
 */
export function metricColorScalars(
  valueByRegion: Record<string, number | null>,
  format: ExplorerFormat,
  betterHigh: boolean,
  precomputedBounds?: [number, number],
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  let lo: number, hi: number;
  if (precomputedBounds) {
    [lo, hi] = precomputedBounds;
  } else {
    const sorted = Object.values(valueByRegion)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (!sorted.length) {
      for (const id of Object.keys(valueByRegion)) result[id] = null;
      return result;
    }
    [lo, hi] = percentileBounds(sorted, format);
  }
  const span = hi - lo;
  for (const [id, v] of Object.entries(valueByRegion)) {
    if (v == null) {
      result[id] = null;
      continue;
    }
    const clamped = Math.min(hi, Math.max(lo, v));
    const t = span === 0 ? 0.5 : (clamped - lo) / span;
    result[id] = (betterHigh ? t : 1 - t) * 100;
  }
  return result;
}

/**
 * Same bounds strategy as `metricColorScalars`, exposed standalone so a
 * caller can precompute GLOBAL bounds once (across every region and every
 * month) and reuse them across many `metricColorScalars` calls instead of
 * each one recomputing from a single snapshot.
 */
export function computeMetricBounds(
  values: number[],
  format: ExplorerFormat,
): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return [0, 1];
  return percentileBounds(sorted, format);
}
