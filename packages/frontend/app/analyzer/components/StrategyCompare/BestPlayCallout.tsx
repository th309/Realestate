"use client";

import { fmtUsd } from "../../lib/format-helpers";

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
    // irr10 is a decimal (0.089 = 8.9%); multiply by 100 for the percent
    // display. The compare card uses fmtPct() which does the same. Without
    // the *100 the callout used to show "0.1% IRR" for an 8.9% return.
    tagline: (s) =>
      `${(s.buyAndHold.irr10 * 100).toFixed(1)}% IRR (10y) · ${fmtUsd(s.buyAndHold.cashflowMonthly)}/mo cashflow`,
  },
  flip: {
    name: "Flip",
    tagline: (s) =>
      `${s.flip.roiPct.toFixed(1)}% ROI · ${fmtUsd(s.flip.projectedProfit)} profit`,
  },
  brrrr: {
    name: "BRRRR",
    tagline: (s) =>
      `Score ${s.brrrr.score} · ${fmtUsd(s.brrrr.postRefiCashflow)}/mo post-refi cashflow`,
  },
};

interface BestPlayCalloutProps {
  scores: StrategyScores;
  /** When verdict is bad/avoid, switch the "Best play" framing to "Least bad
   *  option" so the user isn't told a losing deal is the BEST play. */
  isDealViable?: boolean;
}

export function BestPlayCallout({
  scores,
  isDealViable = true,
}: BestPlayCalloutProps) {
  const winner = pickBestPlay(scores);
  const c = COPY[winner];
  const heading = isDealViable ? "Best play" : "Least bad option";
  // Tertiary (green) container for viable deals; muted neutral for non-viable
  // ones so the user isn't visually rewarded for a losing strategy.
  const containerClass = isDealViable
    ? "bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)]"
    : "bg-surface-container-low text-on-surface-variant border border-outline-variant";
  return (
    <div
      data-best-play
      data-winner={winner}
      data-viable={isDealViable}
      className={`flex items-center gap-3 rounded-xl px-5 py-3 ${containerClass}`}
    >
      <span aria-hidden className="text-xl">
        {isDealViable ? "★" : "⚠"}
      </span>
      <div className="flex-1">
        <div className="text-xs font-bold uppercase tracking-wider opacity-70">
          {heading}
        </div>
        <div className="text-sm font-semibold">
          {c.name} — {c.tagline(scores)}
        </div>
      </div>
    </div>
  );
}
