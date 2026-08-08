"use client";

import type { RangeOption } from "./SignatureChartHelpers";

interface RangePillsProps {
  ranges: RangeOption[];
  active: number;
  onChange: (years: number) => void;
  /**
   * Retained for call-site compatibility and ignored. The selector no longer
   * tints itself with the chart's series colour — see the note below.
   */
  color?: string;
}

/**
 * Time-range selector — the spec's `.rng`: a recessed canvas track with the
 * active range raised on a white chip in indigo.
 *
 * It used to tint itself with whatever colour the chart's primary series
 * happened to be, so the same control was green on the after-tax card, indigo
 * on the projection, and red on a losing series. A range selector is chrome,
 * not data: it should look identical on every card and not imply that "10Y"
 * is somehow green. Indigo is the interaction colour everywhere else on the
 * page, so it is the interaction colour here too.
 */
export function RangePills({ ranges, active, onChange }: RangePillsProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-[9px] bg-piq-canvas p-[3px]"
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
            className={`rounded-[7px] px-2.5 py-[5px] text-[11.5px] font-semibold tabular-nums transition-colors duration-200 ${
              isActive
                ? "bg-piq-surface text-piq-indigo shadow-piq"
                : "bg-transparent text-piq-body hover:text-piq-ink"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
