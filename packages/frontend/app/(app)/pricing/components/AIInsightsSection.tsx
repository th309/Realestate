"use client";

import { Sparkles, BarChart3 } from "lucide-react";
import { getScoreLabel } from "@/app/components/scoring/score-labels";
import { CollapsibleFeature } from "./CollapsibleFeature";
import { TierBadge } from "./TierBadge";
import { IllustrativeNote } from "./IllustrativeNote";

/** Sample score used by the mock Nashville panels. Not a live reading — see
 *  IllustrativeNote. Kept as a constant so the momentum label below it is
 *  always derived from the number actually rendered. */
const SAMPLE_SCORE = 62;

export function AIInsightsSection() {
  return (
    <CollapsibleFeature
      id="ai-insights"
      icon={<Sparkles className="w-5 h-5 text-primary" />}
      title="AI Market Analysis"
      subtitle="Included with Pro"
      summary="Our AI reads 60+ metrics and tells you what they actually mean."
    >
      <div className="mb-8">
        <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
          <li>
            Prices up, but inventory surging. Job growth strong, but
            affordability collapsing.{" "}
            <strong className="text-on-surface">
              60+ metrics that often contradict each other.
            </strong>
          </li>
          <li>
            Our AI reads the full picture and tells you what it actually means.
          </li>
          <li className="text-on-surface font-medium">
            The kind of analysis that used to require a $500/hr market
            consultant. Yours for less than a dollar a day.
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
          <div className="space-y-3 text-sm text-on-surface-variant leading-relaxed">
            <div>
              <span className="text-xs font-semibold text-on-surface/70 block mb-1">
                Affordability
              </span>
              Nashville&apos;s PropertyIQ Score is {SAMPLE_SCORE} (
              {getScoreLabel(SAMPLE_SCORE)}). The median listing price is $445K.
              You&apos;d need roughly $98K in annual income to afford a home
              here.
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface/70 block mb-1">
                Market Speed
              </span>
              Homes in Nashville average 34 days on market. Inventory is up
              12.3% year-over-year. The pending ratio sits at 38%.
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/20 text-[11px] text-on-surface-variant/40 italic">
            Numbers without context. You have to figure out what they mean.
          </div>
          <IllustrativeNote />
        </div>

        {/* Pro */}
        <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(57,73,171,0.12)]">
          <div className="absolute top-4 right-4">
            <TierBadge tier="pro" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              What you&apos;re missing
            </span>
          </div>
          <div className="space-y-3 text-[13.5px] text-on-surface leading-relaxed">
            <div>
              <span className="text-xs font-bold block mb-1">
                Affordability
              </span>
              Nashville&apos;s market presents a mixed affordability picture
              that <strong>rewards strategic timing</strong>. While $445K
              requires ~$98K income, a {getScoreLabel(SAMPLE_SCORE)} score of{" "}
              {SAMPLE_SCORE} says demand is still building rather than peaking.
              Key leverage point: the 4.2-year save-to-buy timeline is{" "}
              <em>compressing</em> as new construction in Antioch and Hermitage
              expands sub-$350K inventory. First-time buyers should watch the
              spring listings surge.
            </div>
            <div>
              <span className="text-xs font-bold block mb-1">Market Speed</span>
              The 34-day DOM{" "}
              <strong>masks meaningful divergence across price tiers</strong> —
              homes under $400K move in 18 days while $600K+ listings linger at
              55+. The 12.3% inventory increase is heavily weighted toward new
              builds, not motivated sellers. The pending ratio has been climbing
              three consecutive months —{" "}
              <em>a leading indicator of tightening conditions</em>.
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-primary/10 flex items-center gap-1.5 text-[11px] text-primary/70 font-medium">
            <Sparkles className="w-3 h-3" />
            Actionable intelligence from 60+ data points, local news, and market
            signals
          </div>
          <IllustrativeNote detail="Sample narrative in the style Pro generates — the figures are examples, not live Nashville data." />
        </div>
      </div>
    </CollapsibleFeature>
  );
}
