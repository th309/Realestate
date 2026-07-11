"use client";

/**
 * Live per-month momentum breakdown (hero size only) — the same three buckets
 * as the forecast page's stat cards, recomputed every frame during playback.
 */

import { summarizeFrame } from "./momentum-map-colors";

interface MomentumSummaryStripProps {
  scores: number[][];
  currentFrame: number;
}

export function MomentumSummaryStrip({
  scores,
  currentFrame,
}: MomentumSummaryStripProps) {
  const summary = summarizeFrame(scores, currentFrame);
  const tiles = [
    { pct: summary.risingPct, label: "Firming or rising momentum" },
    { pct: summary.steadyPct, label: "Steady, near state average" },
    { pct: summary.easingPct, label: "Easing or weak momentum" },
  ];

  return (
    <div
      data-testid="momentum-summary-strip"
      className="mt-4 grid grid-cols-3 gap-3"
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2"
        >
          <p className="font-mono text-xl text-on-surface">{tile.pct}%</p>
          <p className="text-xs text-on-surface-variant">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
