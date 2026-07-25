"use client";
import React from "react";
import { formatMetricValue } from "@/lib/data";
import { TREND_WINDOW_MONTHS } from "../lib/explorer-math";
import { Sparkline } from "./Sparkline";

type Series = (number | null)[];
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
    dot: string,
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
    const col =
      Math.abs(d) < 0.05
        ? "var(--md-on-surface-variant)"
        : up
          ? "var(--md-tertiary)"
          : "var(--md-error)";
    return (
      <div
        key={label}
        style={{
          background: "var(--md-surface-container)",
          border: "1px solid var(--md-outline-variant)",
          borderRadius: 12,
          padding: "14px 16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            color: "var(--md-on-surface-variant)",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 3,
              background: dot,
              flex: "none",
            }}
          />
          {label}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-roboto-mono)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--md-on-surface)",
              lineHeight: 1,
            }}
          >
            {cur == null ? "—" : fmt(cur)}
          </span>
          {hasBothValues && (
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 11.5,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 999,
                background: `color-mix(in srgb, ${col} 12%, transparent)`,
                color: col,
              }}
            >
              {(up ? "▲ " : "▼ ") +
                Math.abs(d).toFixed(1) +
                (isPts ? " pt" : "%")}
            </span>
          )}
        </div>
        <div style={{ marginTop: 2 }}>
          <Sparkline
            series={series.slice(windowStart, monthIndex + 1)}
            width={120}
            height={22}
            markerIndex={Math.max(0, monthIndex - windowStart)}
            color={dot}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
        gap: 12,
      }}
    >
      {card(
        "Median value",
        "var(--md-primary)",
        kpiSeries.price,
        (v) => formatMetricValue(v, "currency"),
        false,
      )}
      {isStateScope
        ? card(
            "Home value YoY",
            "var(--md-secondary)",
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
            "var(--md-secondary)",
            kpiSeries.rent,
            (v) => `$${fmtBig(v)}`,
            false,
          )}
      {card(
        "Active listings",
        "var(--md-warning)",
        kpiSeries.inventory,
        (v) => fmtBig(v),
        false,
      )}
      {card(
        "Days on mkt",
        "var(--md-error)",
        kpiSeries.dom,
        (v) => `${Math.round(v)} d`,
        false,
      )}
      {isStateScope
        ? card(
            "Unemployment rate",
            "var(--md-tertiary)",
            kpiSeries.unemployment,
            (v) => `${v.toFixed(1)}%`,
            // Same reasoning as Home Value YoY above — this value is already
            // a percentage, so the trend badge shows the raw point delta.
            true,
          )
        : card(
            "PIQ score",
            "var(--md-tertiary)",
            kpiSeries.score,
            (v) => String(Math.round(v)),
            true,
          )}
    </div>
  );
}
