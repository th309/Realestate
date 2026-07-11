"use client";

/**
 * Per-month movers strip (hero size only): the current frame's leading and
 * lagging metros plus how many metros are scored that month. Replaced the
 * original firming/steady/easing percentage tiles on 2026-07-11: PIQ scores
 * are monthly cross-sectional percentile ranks, so those bucket shares are
 * constant (~40/10/49) in EVERY month by construction — a "live" strip that
 * never moves. Leading/lagging metros genuinely change frame to frame.
 */

import { getMetroShortName, type ScoreHeatmapMetro } from "@/lib/data";
import {
  getScoreLabel,
  getScoreMomentumArrow,
} from "@/app/components/scoring/score-labels";

interface MomentumSummaryStripProps {
  scores: number[][];
  currentFrame: number;
  metros: ScoreHeatmapMetro[];
}

interface FrameMover {
  metro: ScoreHeatmapMetro;
  score: number;
}

/** Ties broken by population so the named metro is the most recognizable one. */
function findFrameMovers(
  scores: number[][],
  currentFrame: number,
  metros: ScoreHeatmapMetro[],
): { leading: FrameMover | null; lagging: FrameMover | null; scored: number } {
  let leading: FrameMover | null = null;
  let lagging: FrameMover | null = null;
  let scored = 0;

  metros.forEach((metro, i) => {
    const score = scores[i]?.[currentFrame] ?? 0;
    if (!score) return;
    scored++;
    if (
      !leading ||
      score > leading.score ||
      (score === leading.score && (metro.pop ?? 0) > (leading.metro.pop ?? 0))
    ) {
      leading = { metro, score };
    }
    if (
      !lagging ||
      score < lagging.score ||
      (score === lagging.score && (metro.pop ?? 0) > (lagging.metro.pop ?? 0))
    ) {
      lagging = { metro, score };
    }
  });

  return { leading, lagging, scored };
}

export function MomentumSummaryStrip({
  scores,
  currentFrame,
  metros,
}: MomentumSummaryStripProps) {
  const { leading, lagging, scored } = findFrameMovers(
    scores,
    currentFrame,
    metros,
  );

  return (
    <div
      data-testid="momentum-summary-strip"
      className="mt-4 grid grid-cols-3 gap-3"
    >
      <MoverTile eyebrow="Leading" mover={leading} testId="momentum-leading" />
      <MoverTile eyebrow="Lagging" mover={lagging} testId="momentum-lagging" />
      <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2">
        <p className="font-mono text-xl text-on-surface">
          {scored.toLocaleString("en-US")}
        </p>
        <p className="text-xs text-on-surface-variant">
          metros scored this month
        </p>
      </div>
    </div>
  );
}

function MoverTile({
  eyebrow,
  mover,
  testId,
}: {
  eyebrow: string;
  mover: FrameMover | null;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-outline-variant bg-surface px-3 py-2"
    >
      <p className="text-xs uppercase tracking-wide text-on-surface-variant">
        {eyebrow}
      </p>
      {mover ? (
        <>
          <p className="truncate text-sm font-medium text-on-surface">
            {getMetroShortName(mover.metro.name)}
          </p>
          <p className="font-mono text-sm text-on-surface">
            {mover.score} · {getScoreLabel(mover.score)}{" "}
            {getScoreMomentumArrow(mover.score)}
          </p>
        </>
      ) : (
        <p className="text-sm text-on-surface-variant">No data</p>
      )}
    </div>
  );
}
