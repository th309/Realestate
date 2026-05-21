"use client";

import { piq } from "./piqTokens";

interface CompsTooltipProps {
  x: number;
  y: number;
  label: string;
  sub?: string;
}

/**
 * Compact two-line tooltip used by CompsDistribution. Positioned absolute over
 * the chart container; pointer-events: none so it never blocks bar hover.
 */
export function CompsTooltip({ x, y, label, sub }: CompsTooltipProps) {
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, calc(-100% - 10px))",
        pointerEvents: "none",
        background: piq.surface,
        border: `0.5px solid ${piq.border}`,
        borderRadius: 8,
        padding: "6px 10px",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
        zIndex: 10,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: piq.textPrimary,
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "11px",
            color: piq.textMuted,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
