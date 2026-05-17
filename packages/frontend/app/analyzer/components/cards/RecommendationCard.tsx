"use client";

import type { DealGradingResult } from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";
import { useCountUp } from "../../lib/use-count-up";
import "./grade-pulse.css";

interface RecommendationCardProps {
  result: DealGradingResult;
  /** Optional. When provided, renders a "Customize criteria" chip in the meta row that opens the thresholds drawer. */
  onCustomizeClick?: () => void;
  /** Display name of the active threshold preset (e.g. "Balanced") shown in the chip. */
  presetLabel?: string;
}

export function RecommendationCard({
  result,
  onCustomizeClick,
  presetLabel = "Balanced",
}: RecommendationCardProps) {
  const color = getGradeColor(result.letter);
  const gpa = useCountUp(result.finalGpa, { durationMs: 600, precision: 2 });
  const marketAdj = result.marketAdjustment;
  const marketAdjSign = marketAdj >= 0 ? "+" : "";

  return (
    <div
      data-recommendation-card
      data-grade={result.letter}
      className="rounded-2xl border border-outline-variant bg-surface relative overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: color.fg }}
      />
      <div className="p-6 grid grid-cols-[auto_1fr] gap-6 items-center">
        <div
          data-grade-letter
          role="img"
          aria-label={`Grade ${result.letter}, ${result.label}`}
          className="piq-grade-letter rounded-2xl flex items-center justify-center px-6 py-2 tabular-nums"
          style={
            {
              color: color.fg,
              background: color.bg,
              fontFamily: "var(--font-roboto-mono)",
              fontSize: "96px",
              fontWeight: 700,
              lineHeight: 1,
              "--piq-grade-glow": color.glow,
            } as React.CSSProperties
          }
        >
          {result.letter}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <h2
            data-recommendation-label
            className="text-2xl font-semibold text-on-surface leading-tight"
            style={{ fontFamily: "var(--font-source-serif)" }}
          >
            {result.label}
          </h2>
          <p
            data-recommendation-summary
            className="text-base text-on-surface-variant leading-snug"
          >
            {result.summary}
          </p>
          <div data-recommendation-meta className="mt-1 flex flex-wrap gap-2">
            <span
              data-meta-pill="gpa"
              className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant tabular-nums"
            >
              GPA {gpa.toFixed(2)} / 4.00
            </span>
            <span
              data-meta-pill="market-adj"
              className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant tabular-nums"
            >
              Market adj {marketAdjSign}
              {marketAdj.toFixed(2)}
            </span>
            {result.flooredAt && (
              <span
                data-meta-pill="floored"
                className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant/70 tabular-nums"
              >
                Floored at {result.flooredAt}
              </span>
            )}
            {onCustomizeClick && (
              <button
                type="button"
                data-meta-pill="customize"
                onClick={onCustomizeClick}
                className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
                aria-label={`Customize grading criteria (current: ${presetLabel})`}
              >
                ⚙ Graded against {presetLabel} criteria · Customize
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
