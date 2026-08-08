"use client";

import type { DealGradingResult } from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";
import { useCountUp } from "../../lib/use-count-up";
import type { SectionAiProps } from "../../lib/use-section-ai-insights";
import { PiqCard, withMonoNumerals } from "../primitives/card";
import "./grade-pulse.css";

interface RecommendationCardProps {
  result: DealGradingResult;
  /** Optional. When provided, renders a "Customize criteria" chip in the meta row that opens the thresholds drawer. */
  onCustomizeClick?: () => void;
  /** Display name of the active threshold preset (e.g. "Balanced") shown in the chip. */
  presetLabel?: string;
  /** Per-deal AI analysis. When `aiText` is non-empty (or loading), the
   *  card's summary line is replaced by the AI paragraph. Otherwise the
   *  card falls back to the deterministic `result.summary`. */
  aiProps?: SectionAiProps;
}

/** The spec's `.vc`: a canvas-filled pill whose value is set in mono. */
function VerdictChip({ label, value }: { label: string; value: string }) {
  return (
    // The literal space is for textContent, not layout — the flex gap handles
    // the spacing, but without it the pill copies as "Floored atD".
    <span className="inline-flex items-center gap-1.5 rounded-full border border-piq-line bg-piq-canvas px-3 py-[5px] text-[11.5px] font-semibold text-piq-body">
      {label}{" "}
      <b className="font-mono font-semibold tabular-nums text-piq-ink">
        {value}
      </b>
    </span>
  );
}

/**
 * The verdict: a large grade mark, the call in plain words, and the reasoning
 * underneath.
 *
 * The narrative is set as body prose rather than the italic indigo it used to
 * be. A full paragraph in italic is slower to read and, in the brand's indigo,
 * read as a pull-quote — decoration rather than the actual finding. It is the
 * most important text on the page, so it gets the plainest treatment; only the
 * figures inside it shift to mono, which is where the eye is going anyway.
 */
export function RecommendationCard({
  result,
  onCustomizeClick,
  presetLabel = "Balanced",
  aiProps,
}: RecommendationCardProps) {
  const color = getGradeColor(result.letter);
  const gpa = useCountUp(result.finalGpa, { durationMs: 600, precision: 2 });
  const marketAdj = result.marketAdjustment;
  const marketAdjSign = marketAdj >= 0 ? "+" : "";
  const aiText = aiProps?.aiText?.trim();

  return (
    <PiqCard topAccent={color.fg}>
      <div
        data-recommendation-card
        data-grade={result.letter}
        className="grid grid-cols-1 gap-5 p-[26px] sm:grid-cols-[118px_minmax(0,1fr)] sm:items-start"
      >
        <div
          data-grade-letter
          role="img"
          aria-label={`Grade ${result.letter}, ${result.label}`}
          className="piq-grade-letter grid size-[106px] place-items-center rounded-[22px] font-mono text-[56px] font-bold leading-none tabular-nums"
          style={{
            color: color.fg,
            background: color.bg,
            border: `1px solid color-mix(in srgb, ${color.fg} 25%, transparent)`,
          }}
        >
          {result.letter}
        </div>

        <div className="min-w-0">
          <h2
            data-recommendation-label
            className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-piq-ink"
          >
            {result.label}
          </h2>

          {aiProps?.aiIsLoading ? (
            <p
              data-recommendation-summary
              data-ai-loading
              className="mt-2.5 text-[14.5px] italic leading-[1.65] text-piq-muted"
            >
              Generating deal analysis…
            </p>
          ) : (
            <p
              data-recommendation-summary
              data-ai-source={aiText ? "llm" : "fallback"}
              className="mt-2.5 text-[14.5px] leading-[1.65] text-piq-body"
            >
              {withMonoNumerals(aiText || result.summary)}
            </p>
          )}

          <div
            data-recommendation-meta
            className="mt-4 flex flex-wrap items-center gap-[7px]"
          >
            <span data-meta-pill="gpa">
              <VerdictChip label="GPA" value={`${gpa.toFixed(2)} / 4.00`} />
            </span>
            <span data-meta-pill="market-adj">
              <VerdictChip
                label="Market adj"
                value={`${marketAdjSign}${marketAdj.toFixed(2)}`}
              />
            </span>
            {result.flooredAt && (
              <span data-meta-pill="floored">
                <VerdictChip label="Floored at" value={result.flooredAt} />
              </span>
            )}
            <span data-meta-pill="customize">
              <VerdictChip label="Graded against" value={presetLabel} />
            </span>
            {onCustomizeClick && (
              <button
                type="button"
                data-testid="grade-edit-criteria"
                onClick={onCustomizeClick}
                aria-label="Edit grading criteria"
                className="rounded-full border border-piq-line px-3 py-[5px] text-[11.5px] font-bold text-piq-indigo transition-colors duration-200 hover:bg-piq-canvas"
              >
                Edit criteria
              </button>
            )}
          </div>
        </div>
      </div>
    </PiqCard>
  );
}
