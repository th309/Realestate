"use client";

import { piq } from "./piqTokens";
import { MetricBlock } from "./MetricBlock";
import type { BarItem, BarValueFormat } from "./DirectionalBarsHelpers";

export type TooltipSide = "top" | "right" | "left";

interface BarTooltipProps {
  item: BarItem;
  format: BarValueFormat;
  x: number;
  y: number;
  side?: TooltipSide;
}

const TRANSFORM: Record<TooltipSide, string> = {
  top: "translate(-50%, calc(-100% - 10px))",
  right: "translate(12px, -50%)",
  left: "translate(calc(-100% - 12px), -50%)",
};

/**
 * Floating tooltip card positioned absolutely over the chart container. Uses
 * the MetricBlock pattern (muted label + value) plus an optional muted
 * descriptor line for the `tooltip` field. The `number` BarValueFormat maps to
 * MetricBlock's `number` format — anything else maps directly.
 */
export function BarTooltip({
  item,
  format,
  x,
  y,
  side = "top",
}: BarTooltipProps) {
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: TRANSFORM[side],
        pointerEvents: "none",
        background: piq.surface,
        border: `0.5px solid ${piq.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
        zIndex: 10,
        minWidth: 120,
        maxWidth: 260,
      }}
    >
      <MetricBlock
        label={item.label}
        value={item.value}
        format={format}
        size="sm"
        variant="neutral"
      />
      {item.tooltip && (
        <div
          style={{
            fontSize: "11px",
            color: piq.textMuted,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {item.tooltip}
        </div>
      )}
    </div>
  );
}
