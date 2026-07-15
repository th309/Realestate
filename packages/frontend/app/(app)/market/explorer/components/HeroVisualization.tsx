"use client";
import React from "react";

export interface HeroVisualizationProps {
  title: string;
  hint: string;
  view: "bubbles" | "map";
  onSetView: (v: "bubbles" | "map") => void;
  hasNearby: boolean;
  includeNearby: boolean;
  onToggleNearby: () => void;
  nearbyLabel: string;
  chart: React.ReactNode;
  scrubber: React.ReactNode;
}

export function HeroVisualization(props: HeroVisualizationProps) {
  const {
    title,
    hint,
    view,
    onSetView,
    hasNearby,
    includeNearby,
    onToggleNearby,
    nearbyLabel,
    chart,
    scrubber,
  } = props;
  const tab = (v: "bubbles" | "map", label: string, icon: string) => (
    <button
      key={v}
      onClick={() => onSetView(v)}
      style={{
        border: "none",
        cursor: "pointer",
        padding: "5px 13px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background:
          view === v ? "var(--md-surface-container-lowest)" : "transparent",
        color:
          view === v ? "var(--md-primary)" : "var(--md-on-surface-variant)",
        boxShadow: view === v ? "0 1px 4px rgba(0,0,0,.18)" : "none",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span aria-hidden="true">{icon}</span> <span>{label}</span>
    </button>
  );
  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 0",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--md-on-surface)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--md-surface-container-high)",
              borderRadius: 999,
              padding: 2,
              gap: 2,
            }}
          >
            {tab("bubbles", "Bubbles", "◉")}
            {tab("map", "Map", "▦")}
          </div>
          {hasNearby && (
            <button
              onClick={onToggleNearby}
              style={{
                border: `1px dashed ${includeNearby ? "var(--md-primary)" : "var(--md-outline)"}`,
                cursor: "pointer",
                padding: "5px 13px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: includeNearby
                  ? "color-mix(in srgb, var(--md-primary) 12%, transparent)"
                  : "transparent",
                color: includeNearby
                  ? "var(--md-primary)"
                  : "var(--md-on-surface-variant)",
                whiteSpace: "nowrap",
              }}
            >
              {nearbyLabel}
            </button>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: "var(--md-on-surface-variant)",
            }}
          >
            <span>Cooling</span>
            <span
              style={{
                width: 90,
                height: 8,
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, var(--piq-red), var(--piq-amber), var(--piq-green))",
                display: "inline-block",
              }}
            />
            <span>Rising</span>
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "2px 20px 0",
          fontSize: 11.5,
          color: "var(--md-on-surface-variant)",
        }}
      >
        {hint}
      </div>
      <div style={{ padding: "8px 12px 0" }}>{chart}</div>
      {scrubber}
    </div>
  );
}
