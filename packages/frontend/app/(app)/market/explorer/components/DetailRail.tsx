"use client";
import React from "react";
import { ScoreGaugeRing } from "@/app/components/scoring/ScoreGaugeRing";
import { ConfidenceDisplay } from "@/app/components/scoring/ConfidenceDisplay";
import { InheritedBadge } from "@/app/components/scoring/InheritedBadge";
import { Sparkline } from "./Sparkline";

export interface DetailRailProps {
  name: string;
  sub: string;
  score: number | null;
  confidence: {
    level: "a" | "b" | "c" | "f";
    percentage: number;
    metricsAvailable: number;
    metricsTotal: number;
    freshnessInDays: number;
  };
  inherited: {
    sourceType: "county" | "metro" | "state" | "national";
    sourceName?: string;
  } | null;
  stats: { label: string; value: string; color: string }[];
  metricLabel: string;
  metricValueNow: string;
  railSpark: (number | null)[];
  railMarker: number;
  isPinned: boolean;
  onTogglePin: () => void;
  hasDrill: boolean;
  drillLabel: string;
  onDrill: () => void;
  onOpenDashboard: () => void;
}

export function DetailRail(props: DetailRailProps) {
  const {
    name,
    sub,
    score,
    confidence,
    inherited,
    stats,
    metricLabel,
    metricValueNow,
    railSpark,
    railMarker,
    isPinned,
    onTogglePin,
    hasDrill,
    drillLabel,
    onDrill,
    onOpenDashboard,
  } = props;
  return (
    <aside
      style={{
        position: "sticky",
        top: 84,
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--md-on-surface)",
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--md-on-surface-variant)",
              marginTop: 3,
            }}
          >
            {sub}
          </div>
        </div>
        <button
          onClick={onTogglePin}
          style={{
            border: `1px solid ${isPinned ? "var(--md-tertiary)" : "var(--md-outline)"}`,
            background: isPinned
              ? "color-mix(in srgb, var(--md-tertiary) 12%, transparent)"
              : "transparent",
            color: isPinned
              ? "var(--md-tertiary)"
              : "var(--md-on-surface-variant)",
            cursor: "pointer",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {isPinned ? "✓ Pinned" : "+ Compare"}
        </button>
      </div>
      <div
        style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}
      >
        <ScoreGaugeRing value={score ?? 50} size={150} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <ConfidenceDisplay
          level={confidence.level}
          percentage={confidence.percentage}
          metricsAvailable={confidence.metricsAvailable}
          metricsTotal={confidence.metricsTotal}
          freshnessInDays={confidence.freshnessInDays}
          showDetails
        />
        {inherited && (
          <InheritedBadge
            sourceType={inherited.sourceType}
            sourceName={inherited.sourceName}
          />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--md-surface-container-low)",
              border:
                "1px solid color-mix(in srgb, var(--md-outline-variant) 70%, transparent)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                textTransform: "uppercase",
                color: "var(--md-on-surface-variant)",
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 15,
                fontWeight: 600,
                color: s.color,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--md-on-surface-variant)",
            }}
          >
            {metricLabel} · trend
          </span>
          <span
            style={{
              fontFamily: "var(--font-roboto-mono)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--md-primary)",
            }}
          >
            {metricValueNow}
          </span>
        </div>
        <Sparkline
          series={railSpark}
          width={316}
          height={80}
          markerIndex={railMarker}
        />
      </div>
      {hasDrill && (
        <button
          onClick={onDrill}
          style={{
            border: "1px solid var(--md-outline)",
            cursor: "pointer",
            background: "color-mix(in srgb, var(--md-primary) 8%, transparent)",
            color: "var(--md-primary)",
            padding: "10px 16px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {drillLabel}
        </button>
      )}
      <button
        onClick={onOpenDashboard}
        style={{
          border: "none",
          cursor: "pointer",
          background: "var(--md-primary)",
          color: "var(--md-on-primary)",
          padding: "11px 16px",
          borderRadius: 999,
          fontSize: 13.5,
          fontWeight: 500,
          boxShadow:
            "0 2px 8px color-mix(in srgb, var(--md-primary) 35%, transparent)",
        }}
      >
        Open full market dashboard →
      </button>
    </aside>
  );
}
