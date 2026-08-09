/**
 * chart-theme — the single source of truth for Recharts/SVG colors.
 *
 * WHY THIS EXISTS
 * ---------------
 * Chart colors are written as strings into SVG props (`stroke="…"`, `fill="…"`)
 * and inline styles. TypeScript cannot check a color string, and CSS `var()`
 * fails *silently* when the custom property does not exist. The two failure
 * modes are asymmetric, which is what makes the bug so hard to spot:
 *
 *   - an unresolvable `fill`   falls back to the SVG initial value `black`
 *     → the element still renders, just in the wrong color
 *   - an unresolvable `stroke` falls back to the SVG initial value `none`
 *     → the element renders completely INVISIBLE
 *
 * That is exactly how the admin Daily Active Users chart shipped a correctly
 * scaled axis frame with no line and no gridlines: every chart in the file was
 * painted with `var(--primary)` / `var(--outline-variant)`, and this codebase
 * has no such custom properties. `globals.css` exposes M3 tokens under two
 * namespaces — `--md-*` (raw) and `--color-*` (the Tailwind v4 `@theme` alias
 * that also generates `bg-primary`, `text-on-surface-variant`, …). The bare
 * names were never defined.
 *
 * Importing from here makes that class of typo a compile-time error instead of
 * an invisible line, and keeps chart chrome on the brand tokens per CLAUDE.md
 * §8.2 (semantic variables, never hardcoded hex).
 */

/**
 * Semantic colors for chart chrome and data marks.
 *
 * Every value resolves through the Tailwind `@theme` layer in `app/globals.css`,
 * so these follow light/dark mode automatically. Never inline a raw
 * `var(--something)` into a chart — add a named entry here instead.
 */
export const CHART_COLORS = {
  /** Dashed background grid. */
  grid: "var(--color-outline-variant)",
  /** The solid axis rule itself. */
  axisLine: "var(--color-outline-variant)",
  /** Axis tick labels and in-chart annotation text. */
  axisText: "var(--color-on-surface-variant)",

  /** The primary data series — brand indigo. */
  primarySeries: "var(--color-primary)",
  /** A secondary/comparison series, e.g. "previous period". */
  comparisonSeries: "var(--color-outline)",
  /** Reference lines: annotation markers, targets, zero-crossings. */
  reference: "var(--color-tertiary)",
  /** Marks that carry a negative meaning (loss, churn, drawdown). */
  negative: "var(--color-error)",
  /** Marks that carry a positive meaning (growth, gain). */
  positive: "var(--color-accent-teal)",

  /** Backdrop for the floating tooltip surface. */
  tooltipSurface: "var(--color-surface-container)",
  /** Border of the floating tooltip surface. */
  tooltipBorder: "var(--color-outline-variant)",
} as const;

export type ChartColor = (typeof CHART_COLORS)[keyof typeof CHART_COLORS];

/**
 * Shared `contentStyle` for Recharts `<Tooltip>` so every chart's tooltip has
 * the same surface, radius, and type scale.
 */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.tooltipSurface,
  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
  borderRadius: "8px",
  fontSize: "12px",
} as const;

/**
 * Shared `tick` style for Recharts `<XAxis>` / `<YAxis>`.
 * `size` defaults to the 11px used across the admin dashboards.
 */
export function chartAxisTick(size: number = 11) {
  return { fontSize: size, fill: CHART_COLORS.axisText };
}

/** Shared `axisLine` style for Recharts `<XAxis>` / `<YAxis>`. */
export const CHART_AXIS_LINE = { stroke: CHART_COLORS.axisLine } as const;
