"use client";

export interface StrategyScores {
  buyAndHold: { irr10: number; cashflowMonthly: number };
  flip: { roiPct: number; projectedProfit: number };
  brrrr: { score: number; postRefiCashflow: number };
}

export type Winner = "buyAndHold" | "flip" | "brrrr";

/**
 * Deterministic ranking. Higher score = better.
 * - BRRRR wins if its score >= 80 AND post-refi cashflow positive
 * - Flip wins if ROI >= 20% AND profit >= $30K
 * - Else Buy & Hold (lowest bar — default income asset)
 */
export function pickBestPlay(s: StrategyScores): Winner {
  if (s.brrrr.score >= 80 && s.brrrr.postRefiCashflow > 0) return "brrrr";
  if (s.flip.roiPct >= 20 && s.flip.projectedProfit >= 30_000) return "flip";
  return "buyAndHold";
}

const COPY: Record<
  Winner,
  { name: string; tagline: (s: StrategyScores) => string }
> = {
  buyAndHold: {
    name: "Buy & Hold",
    tagline: (s) =>
      `${s.buyAndHold.irr10.toFixed(1)}% IRR (10y) · $${Math.round(s.buyAndHold.cashflowMonthly)}/mo cashflow`,
  },
  flip: {
    name: "Flip",
    tagline: (s) =>
      `${s.flip.roiPct.toFixed(1)}% ROI · $${Math.round(s.flip.projectedProfit / 1000)}K profit`,
  },
  brrrr: {
    name: "BRRRR",
    tagline: (s) =>
      `Score ${s.brrrr.score} · $${Math.round(s.brrrr.postRefiCashflow)}/mo post-refi cashflow`,
  },
};

interface BestPlayCalloutProps {
  scores: StrategyScores;
}

export function BestPlayCallout({ scores }: BestPlayCalloutProps) {
  const winner = pickBestPlay(scores);
  const c = COPY[winner];
  return (
    <div
      data-best-play
      data-winner={winner}
      className="flex items-center gap-3 rounded-xl bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)] px-5 py-3"
    >
      <span aria-hidden className="text-xl">
        ★
      </span>
      <div className="flex-1">
        <div className="text-xs font-bold uppercase tracking-wider opacity-70">
          Best play
        </div>
        <div className="text-sm font-semibold">
          {c.name} — {c.tagline(scores)}
        </div>
      </div>
    </div>
  );
}
