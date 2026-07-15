"use client";
import React from "react";
import { formatMetricValue } from "@/lib/data";
import { Sparkline } from "./Sparkline";

type Series = (number | null)[];
export interface KpiStripProps {
  agg: {
    price: Series;
    rent: Series;
    inventory: Series;
    dom: Series;
    score: Series;
  };
  monthIndex: number;
  windowStart: number;
}

const fmtBig = (v: number) =>
  v >= 1e6
    ? `${(v / 1e6).toFixed(2)}M`
    : v >= 1e3
      ? `${Math.round(v / 1e3)}K`
      : String(Math.round(v));

export function KpiStrip({ agg, monthIndex, windowStart }: KpiStripProps) {
  const card = (
    label: string,
    dot: string,
    series: Series,
    fmt: (v: number) => string,
    invertGood: boolean,
    isPts: boolean,
  ) => {
    const cur = series[monthIndex];
    const prev = monthIndex === 0 ? null : series[monthIndex - 1];
    const hasBothValues = cur != null && prev != null;
    const d = hasBothValues
      ? isPts
        ? cur - prev
        : prev
          ? ((cur - prev) / prev) * 100
          : 0
      : 0;
    const up = d >= 0,
      good = invertGood ? !up : up;
    const col =
      Math.abs(d) < 0.05
        ? "var(--md-on-surface-variant)"
        : good
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
            series={series.slice(windowStart)}
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
        agg.price,
        (v) => formatMetricValue(v, "currency"),
        false,
        false,
      )}
      {card(
        "Median rent",
        "var(--md-secondary)",
        agg.rent,
        (v) => `$${fmtBig(v)}`,
        false,
        false,
      )}
      {card(
        "Active listings",
        "var(--md-warning)",
        agg.inventory,
        (v) => fmtBig(v),
        true,
        false,
      )}
      {card(
        "Avg days on mkt",
        "var(--md-error)",
        agg.dom,
        (v) => `${Math.round(v)} d`,
        true,
        false,
      )}
      {card(
        "Avg PIQ score",
        "var(--md-tertiary)",
        agg.score,
        (v) => String(Math.round(v)),
        false,
        true,
      )}
    </div>
  );
}
