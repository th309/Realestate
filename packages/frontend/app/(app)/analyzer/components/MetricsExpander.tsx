"use client";

import { useState } from "react";
import { piq } from "./primitives/piqTokens";
import { MetricBlock } from "./primitives/MetricBlock";
import type { SecondaryTile } from "../lib/strategy-secondary-mappers";

interface MetricsExpanderProps {
  metrics: SecondaryTile[];
  /** Defaults to "All metrics". Section-level usage may want "Show details" etc. */
  label?: string;
  /** Initial open state. Defaults to false. */
  defaultOpen?: boolean;
}

/**
 * Generic inline ▾ disclosure that expands to a 3-column grid of small
 * MetricBlocks. Used by StrategyKPI (strategy-level secondaries) and by
 * section components (per-section detail metrics).
 */
export function MetricsExpander({
  metrics,
  label = "All metrics",
  defaultOpen = false,
}: MetricsExpanderProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div data-metrics-expander>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            background: "transparent",
            border: "none",
            color: piq.textMuted,
            fontSize: "13px",
            fontWeight: 500,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 12,
              textAlign: "center",
            }}
          >
            {open ? "▾" : "▸"}
          </span>
          {label}
        </button>
      </div>
      {open && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mt-3"
          style={{
            padding: 20,
            gap: 20,
            background: piq.surface,
            border: `0.5px solid ${piq.border}`,
            borderRadius: 16,
          }}
        >
          {metrics.map((m, i) => (
            <MetricBlock
              key={`${m.label}-${i}`}
              label={m.label}
              value={m.value ?? Number.NaN}
              format={m.format}
              size="sm"
              variant="neutral"
            />
          ))}
        </div>
      )}
    </div>
  );
}
