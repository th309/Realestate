"use client";

import { piq } from "./piqTokens";
import type { RangeOption } from "./SignatureChartHelpers";

interface RangePillsProps {
  ranges: RangeOption[];
  active: number;
  onChange: (years: number) => void;
  color: string;
}

/**
 * Robinhood-style range selector. Inactive pills are transparent + muted text;
 * the active pill uses ~15% opacity of the line color as its background and
 * the full line color as its text. Hex 26 ≈ 15% alpha.
 */
export function RangePills({
  ranges,
  active,
  onChange,
  color,
}: RangePillsProps) {
  return (
    <div
      className="flex items-center gap-1"
      role="tablist"
      aria-label="Time range"
    >
      {ranges.map((r) => {
        const isActive = r.years === active;
        return (
          <button
            key={`${r.label}-${r.years}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(r.years)}
            className="rounded-md transition-colors"
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 500,
              border: "none",
              background: isActive ? `${color}26` : "transparent",
              color: isActive ? color : piq.textMuted,
              cursor: "pointer",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
