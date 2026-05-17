"use client";

import { piq } from "./primitives/piqTokens";
import { useDirectionalColor } from "./primitives/useDirectionalColor";

interface PIQScoreBadgeProps {
  score: number;
  label: string | null;
  /** Optional month-over-month delta. Hidden when null/zero. */
  delta?: number | null;
}

function PIQScoreBadge({ score, label, delta }: PIQScoreBadgeProps) {
  const color = useDirectionalColor({ value: score, variant: "score" });
  const hasDelta = delta != null && Number.isFinite(delta) && delta !== 0;
  const arrow = !hasDelta ? null : delta > 0 ? "▲" : "▼";
  const deltaColor = !hasDelta
    ? piq.textMuted
    : delta > 0
      ? piq.green
      : piq.red;

  return (
    <div className="inline-flex items-center gap-2" data-piq-badge>
      <div
        aria-label={`PropertyIQ score ${Math.round(score)}`}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: color,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {Math.round(score)}
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: piq.textPrimary,
          whiteSpace: "nowrap",
        }}
      >
        PIQ {label ?? ""}
      </span>
      {hasDelta && (
        <span
          style={{
            fontSize: 11,
            color: deltaColor,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {arrow} {Math.abs(delta).toFixed(1)}
        </span>
      )}
    </div>
  );
}

interface PropertyHeaderProps {
  address: string;
  piqScore?: { value: number; label: string | null } | null;
  /** Optional month-over-month delta on the PIQ score. */
  piqDelta?: number | null;
  className?: string;
}

/**
 * Horizontal strip showing the resolved property address on the left and the
 * PropertyIQ score badge inline on the right. Rendered only when an address
 * exists (RentCast-resolved or user-typed).
 */
export function PropertyHeader({
  address,
  piqScore,
  piqDelta,
  className = "",
}: PropertyHeaderProps) {
  return (
    <div
      data-property-header
      className={`flex items-center justify-between gap-4 mb-6 ${className}`}
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: piq.canvas,
        border: `0.5px solid ${piq.border}`,
      }}
    >
      <span
        className="truncate"
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: piq.textPrimary,
          letterSpacing: "-0.005em",
        }}
      >
        {address}
      </span>
      {piqScore && (
        <PIQScoreBadge
          score={piqScore.value}
          label={piqScore.label}
          delta={piqDelta}
        />
      )}
    </div>
  );
}
