import {
  getScoreColor,
  getScoreLabel,
} from "@/app/components/scoring/ScoreDisplay";

/**
 * Compact 1-99 score, for table cells and dense rows. Colour and label both
 * come from the canonical scoring helpers so a pill can never disagree with a
 * ScoreDisplay elsewhere on the page. The label is a momentum word, never a
 * quality grade (CLAUDE.md section 9).
 */
export function ScorePill({
  score,
  showLabel = false,
}: {
  score: number;
  showLabel?: boolean;
}) {
  const clamped = Math.max(1, Math.min(99, Math.round(score)));

  return (
    <span
      data-testid="score-pill"
      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-2.5 py-1"
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: getScoreColor(clamped) }}
        aria-hidden="true"
      />
      <span className="font-mono text-sm font-semibold tabular-nums text-on-surface">
        {clamped}
      </span>
      {showLabel ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-on-surface-variant">
          {getScoreLabel(clamped)}
        </span>
      ) : null}
    </span>
  );
}
