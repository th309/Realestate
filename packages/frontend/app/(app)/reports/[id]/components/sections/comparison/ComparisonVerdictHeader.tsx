"use client";

import { Trophy } from "lucide-react";
import {
  getGradeColor,
  getScoreColor,
  getScoreLabel,
  getScoreMomentumArrow,
  SCORE_MOMENTUM_DESCRIPTOR,
} from "@/app/components/scoring/ScoreDisplay";
import { type MarketBundle, shortMarketName } from "./marketBundles";

/** Tailwind column count for the score-card grid, capped to the market count. */
function gridCols(count: number): string {
  if (count >= 4) return "lg:grid-cols-4";
  if (count === 3) return "lg:grid-cols-3";
  return "lg:grid-cols-2";
}

/**
 * ComparisonVerdictHeader — the hero. One score card per market (2–4) with the
 * live PropertyIQ score, letter grade and momentum label, the leader flagged.
 * This IS the score comparison; the metric tables below explain the gap. Carries
 * the momentum-not-quality disclaimer so a low score never reads as a verdict on
 * the market's worth.
 */
export function ComparisonVerdictHeader({
  markets,
}: {
  markets: MarketBundle[];
}) {
  const scored = markets.filter((m) => m.score != null);
  const top = scored.length
    ? Math.max(...scored.map((m) => m.score as number))
    : null;
  const title = markets.map((m) => shortMarketName(m.name)).join("  vs  ");

  return (
    <header className="mb-10">
      <h1 className="report-heading-lg mb-1 text-on-surface">{title}</h1>
      <p className="mb-5 text-sm text-on-surface-variant">
        {SCORE_MOMENTUM_DESCRIPTOR}
      </p>

      <div className={`grid grid-cols-2 gap-3 ${gridCols(markets.length)}`}>
        {markets.map((m) => {
          const score = m.score;
          const isWinner = top != null && score === top;
          // Only the backend's CONFIDENCE grade (data quality, A/B/C/F) — never
          // a percentile grade derived from the score (a different system).
          const grade = m.grade ?? null;
          const gradeColor = grade ? getGradeColor(grade) : null;
          const color =
            score != null ? getScoreColor(score) : "var(--report-stone)";

          return (
            <div
              key={m.id}
              className={`relative rounded-2xl border p-4 ${
                isWinner
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant bg-surface-container"
              }`}
            >
              {isWinner && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Trophy className="h-3 w-3" aria-hidden="true" /> Top
                </span>
              )}

              <div className="flex items-center gap-1.5 pr-10">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {shortMarketName(m.name)}
                </p>
                {m.isPrimary && (
                  <span className="shrink-0 rounded bg-outline-variant/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-on-surface-variant">
                    Primary
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className="font-mono text-4xl font-bold leading-none tabular-nums"
                  style={{ color }}
                >
                  {score != null ? Math.round(score) : "—"}
                </span>
                {grade && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                      gradeColor?.bg ?? ""
                    } ${gradeColor?.text ?? ""}`}
                  >
                    {grade}
                  </span>
                )}
              </div>

              {score != null && (
                <p
                  className="mt-1.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color }}
                >
                  {getScoreMomentumArrow(score)} {getScoreLabel(score)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}

export default ComparisonVerdictHeader;
