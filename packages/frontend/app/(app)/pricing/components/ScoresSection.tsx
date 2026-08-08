"use client";

import {
  Target,
  BarChart3,
  Check,
  Lock,
  TrendingUp,
  Shield,
} from "lucide-react";
import { formatMarketsScored, V4_CLAIMS } from "@/lib/data/validation-claims";
import {
  getScoreLabel,
  getScoreMomentumArrow,
  getScoreMomentumColorClass,
} from "@/app/components/scoring/score-labels";
import { CollapsibleFeature } from "./CollapsibleFeature";
import { TierBadge } from "./TierBadge";
import { IllustrativeNote } from "./IllustrativeNote";

/** Sample score rendered in the mock Pro panel. Not a live reading — see
 *  IllustrativeNote. Held as a constant so the momentum label and its colour
 *  are always derived from the number actually shown. */
const SAMPLE_SCORE = 68;

export function ScoresSection() {
  return (
    <CollapsibleFeature
      id="scores"
      icon={<Target className="w-5 h-5 text-primary" />}
      title="PropertyIQ Score"
      subtitle={`${formatMarketsScored()} markets scored`}
      summary="A single score that predicts how a market will perform versus its state over the next 3 years."
    >
      <div className="mb-8">
        <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
          <li>
            Raw metrics tell you <em>what happened</em>. The PropertyIQ Score
            tells you{" "}
            <strong className="text-on-surface">
              what&apos;s likely to happen next.
            </strong>
          </li>
          <li>
            One 1–99 score that predicts how a market will perform versus its
            state over the next 3 years — 50 means the market is tracking its
            state average. It combines Zillow price momentum with Realtor.com
            flow signals.
          </li>
          <li className="text-on-surface font-medium">
            Every metro, county, and ZIP in the country —{" "}
            {formatMarketsScored()} markets scored.
          </li>
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Free */}
        <div className="rounded-xl border border-outline-variant bg-surface-container p-5 relative">
          <div className="absolute top-4 right-4">
            <TierBadge tier="free" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-on-surface-variant/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">
              What you get today
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Individual metrics (price, DOM, inventory)
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Year-over-year changes
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No composite scoring
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No score-based market rankings
              </span>
            </div>
          </div>
          <div className="mt-4 bg-surface rounded-lg p-3">
            <div className="text-[10px] font-medium text-on-surface-variant/50 uppercase tracking-wider mb-2">
              Nashville — what you see
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-on-surface-variant/50">Price</span>
                <div className="font-mono tabular-nums font-semibold text-on-surface">
                  $445K
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant/50">DOM</span>
                <div className="font-mono tabular-nums font-semibold text-on-surface">
                  34
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant/50">YoY</span>
                <div className="font-mono tabular-nums font-semibold text-green-600">
                  +3.2%
                </div>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant/40 mt-2 italic">
              Is this firming or easing? Compared to what?
            </p>
          </div>
          <IllustrativeNote />
        </div>

        {/* Pro */}
        <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(57,73,171,0.12)]">
          <div className="absolute top-4 right-4">
            <TierBadge tier="pro" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              What you&apos;re missing
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">
                {formatMarketsScored()} markets scored — metro, county, ZIP
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>PropertyIQ Score</strong> — predicted 3-year performance
                versus the state
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                Confidence rating — how complete and fresh the underlying data
                is
              </span>
            </div>
          </div>
          <div className="mt-4 bg-surface rounded-lg p-3">
            <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Nashville — what you&apos;d see
            </div>
            <div className="text-center">
              <div className="text-[10px] text-on-surface-variant/60">
                PropertyIQ Score
              </div>
              <div className="text-3xl font-mono tabular-nums font-bold text-on-surface leading-tight">
                {SAMPLE_SCORE}
              </div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wider ${getScoreMomentumColorClass(SAMPLE_SCORE)}`}
              >
                {getScoreLabel(SAMPLE_SCORE)}{" "}
                {getScoreMomentumArrow(SAMPLE_SCORE)}
              </div>
              <div className="text-[10px] text-on-surface-variant/60 mt-0.5">
                Confidence B — data quality, not a grade
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex justify-between items-start gap-2 text-[11px]">
              <span className="text-on-surface-variant">
                Score 81–99 markets, annualized 3-year excess vs state
              </span>
              <span className="font-mono tabular-nums font-bold text-green-600 whitespace-nowrap">
                +{V4_CLAIMS.topQuintile3YExcess}pp
              </span>
            </div>
          </div>
          <IllustrativeNote detail="The Nashville score is a sample, not live data. The excess-return figure is the measured 2016+ metro backtest result." />
        </div>
      </div>
    </CollapsibleFeature>
  );
}
