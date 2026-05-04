"use client";

import { ScoreRing } from "../charts/ScoreRing";
import { Section } from "./Section";

interface Props {
  score?: {
    score: number;
    label: string;
    confidenceLetter: string;
    confidencePercent: number;
    quarterChange?: number;
  };
  thesisParagraphs: string[];
  recommendation: string;
  limitedData: boolean;
}

export function ExecutiveSummary({
  score,
  thesisParagraphs,
  recommendation,
  limitedData,
}: Props) {
  if (limitedData || !score) {
    return (
      <Section num="01" title="Executive summary">
        <p className="text-sm text-on-surface-variant">
          Limited data available for this market — full executive summary
          unavailable. The structured signals below remain accurate.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="01"
      title="Executive summary"
      subtitle="The 60-second story you'd tell a seller across a kitchen table."
    >
      <div className="grid grid-cols-1 gap-7 md:grid-cols-[220px_1fr]">
        <div className="rounded-2xl bg-surface-container p-6 text-center">
          <div className="flex justify-center">
            <ScoreRing score={score.score} size="lg" />
          </div>
          <p className="mt-3 text-base font-semibold text-on-surface">
            {score.label}
          </p>
          <p className="mt-1 text-[11.5px] text-on-surface-variant">
            Confidence:{" "}
            <strong className="text-on-primary-container">
              {score.confidenceLetter} · {score.confidencePercent}%
            </strong>
            {typeof score.quarterChange === "number" && (
              <>
                <br />
                {score.quarterChange >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(score.quarterChange)} since last quarter
              </>
            )}
          </p>
        </div>
        <div className="text-[15px] leading-[1.65] text-on-surface">
          {thesisParagraphs.map((p, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {p}
            </p>
          ))}
          <div className="mt-4 rounded-r-xl border-l-[3px] border-tertiary bg-surface-container-lowest px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-tertiary">
              The recommendation
            </p>
            <p className="mt-1 text-sm font-medium text-on-surface">
              {recommendation}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
