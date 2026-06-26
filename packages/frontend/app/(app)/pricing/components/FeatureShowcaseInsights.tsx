"use client";

import {
  Sparkles,
  Target,
  BarChart3,
  Check,
  Lock,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import { formatMarketsScored } from "@/lib/data/validation-claims";
import { CollapsibleFeature } from "./CollapsibleFeature";

/** Free vs Pro tier badge used in feature comparison cards. */
function TierBadge({ tier }: { tier: "free" | "pro" }) {
  if (tier === "free") {
    return (
      <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded">
        Free
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
      <Zap className="w-3 h-3" />
      Pro
    </span>
  );
}

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
              Nashville shows moderate conditions for homebuyers (PropertyIQ
              Score: 62). The median listing price is $445K. You&apos;d need
              roughly $98K in annual income to afford a home here.
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface/70 block mb-1">
                Market Speed
              </span>
              Homes in Nashville average 34 days on market. Inventory is up
              12.3% year-over-year. The pending ratio sits at 38%, indicating
              moderate buyer activity.
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/20 text-[11px] text-on-surface-variant/40 italic">
            Numbers without context. You have to figure out what they mean.
          </div>
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
              requires ~$98K income, the PropertyIQ Score of 62 suggests the
              window hasn&apos;t closed. Key leverage point: the 4.2-year
              save-to-buy timeline is <em>compressing</em> as new construction
              in Antioch and Hermitage expands sub-$350K inventory. First-time
              buyers should watch the spring listings surge.
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
        </div>
      </div>
    </CollapsibleFeature>
  );
}

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
            One score that predicts how a market will perform versus its state
            over the next 3 years — combining Zillow price momentum with
            Realtor.com flow signals.
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
                No grades or market rankings
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
                <div className="font-semibold text-on-surface">$445K</div>
              </div>
              <div>
                <span className="text-on-surface-variant/50">DOM</span>
                <div className="font-semibold text-on-surface">34</div>
              </div>
              <div>
                <span className="text-on-surface-variant/50">YoY</span>
                <div className="font-semibold text-green-600">+3.2%</div>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant/40 mt-2 italic">
              Is this good? Bad? Compared to what?
            </p>
          </div>
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
              <div className="text-3xl font-bold text-on-surface leading-tight">
                68
              </div>
              <div className="text-[10px] font-bold text-amber-600">B</div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex justify-between items-center text-[11px]">
              <span className="text-on-surface-variant">
                Historically, Score 80+ markets
              </span>
              <span className="font-bold text-green-600">
                +12% excess returns
              </span>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleFeature>
  );
}
