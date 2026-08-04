"use client";
import { formatMetricValue } from "@/lib/data";
import { KpiTile } from "@/app/components/app-shell";
import { TREND_WINDOW_MONTHS } from "../lib/explorer-math";
import { Sparkline } from "./Sparkline";

type Series = (number | null)[];
type Accent = "primary" | "secondary" | "tertiary" | "warning" | "error";

export interface KpiStripProps {
  /** Raw per-month series for the CURRENT SCOPE — a scope-wide aggregate
   * (mean, or sum for inventory) across every region currently in view, e.g.
   * all of Colorado's metros when drilled into Colorado. See
   * `aggregateScopeKpis` in explorer-math.ts. Deliberately distinct from
   * whichever single region is selected/highlighted, which the detail rail
   * tracks separately. */
  kpiSeries: {
    price: Series;
    rent: Series;
    inventory: Series;
    dom: Series;
    score: Series;
    homeValueYoy: Series;
    unemployment: Series;
  };
  monthIndex: number;
  /** States have no native PropertyIQ score and no rent_index coverage —
   * swaps Median Rent → Home Value YoY and PIQ Score → Unemployment Rate for
   * this scope only. Metro/county/zip keep the original 5 cards. */
  isStateScope: boolean;
}

const fmtBig = (v: number) =>
  v >= 1e6
    ? `${(v / 1e6).toFixed(2)}M`
    : v >= 1e3
      ? `${Math.round(v / 1e3)}K`
      : String(Math.round(v));

/** Series colour for the sparkline, keyed to the tile's accent stripe. */
const ACCENT_VAR: Record<Accent, string> = {
  primary: "var(--md-primary)",
  secondary: "var(--md-secondary)",
  tertiary: "var(--md-tertiary)",
  warning: "var(--md-warning)",
  error: "var(--md-error)",
};

export function KpiStrip({
  kpiSeries,
  monthIndex,
  isStateScope,
}: KpiStripProps) {
  // Fixed 6-month lookback for BOTH the delta badge AND the sparkline below
  // it — computed from `monthIndex` (wherever the user has scrubbed the
  // main timeline to), NOT from the page-wide "range" preset (6M/1Y/2Y/5Y/
  // 10Y) that governs the main hero chart's zoom. A quick-glance trend
  // indicator should always compare like-for-like windows regardless of how
  // far back the user happens to have the main timeline zoomed.
  const windowStart = Math.max(0, monthIndex - TREND_WINDOW_MONTHS);

  const card = (
    label: string,
    caption: string,
    accent: Accent,
    series: Series,
    fmt: (v: number) => string,
    isPts: boolean,
  ) => {
    const cur = series[monthIndex];
    const prev =
      monthIndex < TREND_WINDOW_MONTHS
        ? null
        : series[monthIndex - TREND_WINDOW_MONTHS];
    const hasBothValues = cur != null && prev != null;
    const d = hasBothValues
      ? isPts
        ? cur - prev
        : prev
          ? ((cur - prev) / prev) * 100
          : 0
      : 0;
    // Direction and color always agree, with no per-metric "is up actually
    // good?" inversion — up is always green with an up-triangle, down is
    // always red with a down-triangle, full stop.
    const up = d >= 0;
    const flat = Math.abs(d) < 0.05;
    const deltaClass = flat
      ? "bg-surface-container text-on-surface-variant"
      : up
        ? "bg-tertiary-container text-tertiary"
        : "bg-error-container text-error";

    return (
      <KpiTile
        key={label}
        label={label}
        caption={caption}
        accent={accent}
        showDot
        value={cur == null ? "—" : fmt(cur)}
        delta={
          hasBothValues ? (
            <span
              data-kpi-delta
              data-direction={flat ? "flat" : up ? "up" : "down"}
              className={`inline-flex items-center gap-1 rounded-full px-[7px] py-0.5 font-mono text-[11px] font-semibold tabular-nums ${deltaClass}`}
            >
              {(up ? "▲ " : "▼ ") +
                Math.abs(d).toFixed(1) +
                (isPts ? " pt" : "%")}
            </span>
          ) : null
        }
        footer={
          <Sparkline
            series={series.slice(windowStart, monthIndex + 1)}
            width={120}
            height={22}
            markerIndex={Math.max(0, monthIndex - windowStart)}
            color={ACCENT_VAR[accent]}
          />
        }
      />
    );
  };

  return (
    // Five-up, dropping to two then one — the mockup's `.kpis` breakpoints.
    <div className="grid grid-cols-1 gap-3.5 min-[621px]:grid-cols-2 min-[1181px]:grid-cols-5">
      {card(
        "Median value",
        "Typical home value in scope",
        "primary",
        kpiSeries.price,
        (v) => formatMetricValue(v, "currency"),
        false,
      )}
      {isStateScope
        ? card(
            "Home value YoY",
            "Change over the last 12 months",
            "secondary",
            kpiSeries.homeValueYoy,
            (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
            // homeValueYoy is ALREADY a percentage — a percent-CHANGE-of-a-
            // percent (e.g. 0.7% -> 4.2% read as "+500%") is meaningless.
            // isPts=true shows the raw point delta instead, same as the
            // score card below.
            true,
          )
        : card(
            "Median rent",
            "Typical asking rent per month",
            "secondary",
            kpiSeries.rent,
            (v) => `$${fmtBig(v)}`,
            false,
          )}
      {card(
        "Active listings",
        "Homes on the market now",
        "warning",
        kpiSeries.inventory,
        (v) => fmtBig(v),
        false,
      )}
      {card(
        "Days on mkt",
        "Median time to go under contract",
        "error",
        kpiSeries.dom,
        (v) => `${Math.round(v)} d`,
        false,
      )}
      {isStateScope
        ? card(
            "Unemployment rate",
            "Share of the labour force out of work",
            "tertiary",
            kpiSeries.unemployment,
            (v) => `${v.toFixed(1)}%`,
            // Same reasoning as Home Value YoY above — this value is already
            // a percentage, so the trend badge shows the raw point delta.
            true,
          )
        : card(
            "PIQ score",
            "1–99, where 50 is this market's state average",
            "tertiary",
            kpiSeries.score,
            (v) => String(Math.round(v)),
            true,
          )}
    </div>
  );
}
