"use client";
import React from "react";
import {
  EXPLORER_METRICS,
  type ExplorerMetricId,
} from "../lib/explorer-config";

export interface MetricSwitcherProps {
  active: ExplorerMetricId;
  disabledIds: ExplorerMetricId[];
  onPick: (id: ExplorerMetricId) => void;
}

export function MetricSwitcher({
  active,
  disabledIds,
  onPick,
}: MetricSwitcherProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--md-on-surface-variant)",
          marginRight: 4,
        }}
      >
        Metric
      </span>
      {EXPLORER_METRICS.map((m) => {
        const isActive = m.id === active;
        const disabled = disabledIds.includes(m.id);
        return (
          <button
            key={m.id}
            disabled={disabled}
            onClick={disabled ? undefined : () => onPick(m.id)}
            title={disabled ? "No data at this geography level" : undefined}
            style={{
              border: `1px solid ${isActive ? "var(--md-primary)" : "var(--md-outline-variant)"}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.4 : 1,
              padding: "7px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              background: isActive
                ? "var(--md-primary)"
                : "var(--md-surface-container-high)",
              color: isActive
                ? "var(--md-on-primary)"
                : "var(--md-on-surface-variant)",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
