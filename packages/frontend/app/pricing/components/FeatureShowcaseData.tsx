"use client";

import {
  Sparkles,
  FileText,
  MapPin,
  BarChart3,
  Check,
  Lock,
  ArrowRight,
  Zap,
} from "lucide-react";
import { CollapsibleFeature } from "./CollapsibleFeature";
import type { PricingTier } from "@/lib/data/fetchers/pricing";

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

export function ReportsSection({
  plans,
  plansLoading,
}: {
  plans: PricingTier[];
  plansLoading: boolean;
}) {
  return (
    <CollapsibleFeature
      id="reports"
      icon={<FileText className="w-5 h-5 text-primary" />}
      title="Market Reports"
      subtitle="Single-market or head-to-head comparison"
      summary="Polished reports with AI narratives, investment thesis, and risk assessment."
    >
      <div className="mb-8">
        <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
          <li>
            Metrics, scores, trends, and AI narratives pulled into one polished
            document.
          </li>
          <li>Focus on a single market or compare two head-to-head.</li>
          <li>
            Share with partners, lenders, or your team — looks like it came from
            a professional analyst.
          </li>
          <li className="text-on-surface font-medium">
            Institutional investors pay thousands for reports like these. Yours
            start at{" "}
            {(() => {
              const pro = plans.find((p) => p.slug === "pro");
              return pro?.price_monthly ? (
                `$${Math.round(Number(pro.price_monthly))}/month`
              ) : plansLoading ? (
                <span className="inline-block w-16 h-4 bg-surface-container animate-pulse rounded align-middle" />
              ) : (
                "$39/month"
              );
            })()}
            .
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
            <FileText className="w-4 h-4 text-on-surface-variant/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">
              What you get today
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Metrics, scores, and trend charts
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Scoring breakdown tables
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Market comparison data
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No AI narratives or summaries
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No executive summary
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No investment thesis or risk assessment
              </span>
            </div>
          </div>
          <p className="text-[10px] text-on-surface-variant/40 mt-4 italic">
            Data tables without the &ldquo;so what.&rdquo;
          </p>
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
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">
                Everything in the data report
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>Executive Summary</strong> — the bottom line, up front
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>Investment Thesis</strong> — buy, hold, or walk away
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>Risk Assessment</strong> — what could go wrong and how
                to hedge
              </span>
            </div>
          </div>
          <div className="mt-4 bg-surface rounded-lg p-3 border border-dashed border-primary/15">
            <p className="text-xs text-on-surface-variant italic leading-relaxed">
              &ldquo;Nashville presents a compelling buy opportunity for
              mid-term investors. The combination of 2.8% job growth, sustained
              in-migration, and a HomeReady score trending upward from 58 to 62
              over six months signals strengthening fundamentals. The primary
              risk — rising inventory — is concentrated in new construction
              above $500K, which doesn&apos;t threaten the core investment
              thesis at sub-$400K price points.&rdquo;
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-primary font-medium">
                Sample AI Executive Summary
              </span>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleFeature>
  );
}

export function GeoDataSection() {
  return (
    <CollapsibleFeature
      id="data-depth"
      icon={<MapPin className="w-5 h-5 text-primary" />}
      title="County & ZIP Code Data"
      subtitle="33,000+ additional markets unlocked"
      summary="Drill from metro to county to ZIP -- where the real deals are."
    >
      <div className="mb-8">
        <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
          <li>
            A metro average tells you almost nothing about the ZIP code where
            you&apos;re actually buying.
          </li>
          <li>
            <strong className="text-on-surface">
              Nashville metro looks moderate — but ZIP 37209 is appreciating at
              5.1% with a 6.2% cap rate.
            </strong>
          </li>
          <li>
            You&apos;d never see that without drilling down. Pro unlocks 3,000+
            counties and 30,000+ ZIP codes.
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
            <MapPin className="w-4 h-4 text-on-surface-variant/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">
              What you get today
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                National overview &amp; state rankings
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                400+ metro-level dashboards
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                County data locked
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                ZIP code data locked
              </span>
            </div>
          </div>
          <div className="mt-4 bg-surface rounded-lg p-3">
            <div className="text-[10px] font-medium text-on-surface-variant/50 uppercase tracking-wider mb-2">
              You stop here
            </div>
            <div className="text-center py-2">
              <div className="text-xs text-on-surface-variant/60 mb-1">
                Nashville-Davidson MSA
              </div>
              <div className="text-lg font-bold text-on-surface">$445K</div>
              <div className="text-xs text-green-600 font-medium">
                +3.2% YoY
              </div>
            </div>
          </div>
        </div>

        {/* Pro */}
        <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(57,73,171,0.12)]">
          <div className="absolute top-4 right-4">
            <TierBadge tier="pro" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              What you&apos;re missing
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">Everything in Free</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">3,000+ county dashboards</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">
                30,000+ ZIP code dashboards
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">
                Metro, county, and ZIP code investment analysis
              </span>
            </div>
          </div>
          <div className="mt-4 bg-surface rounded-lg p-3">
            <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              You drill all the way down
            </div>
            <div className="flex items-center gap-2 text-xs mb-2">
              <span className="text-on-surface-variant/50">Nashville MSA</span>
              <ArrowRight className="w-3 h-3 text-on-surface-variant/30" />
              <span className="text-on-surface-variant/70">Davidson Co.</span>
              <ArrowRight className="w-3 h-3 text-on-surface-variant/30" />
              <span className="font-semibold text-primary">ZIP 37209</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <span className="text-on-surface-variant/60">Price</span>
                <div className="font-bold text-on-surface">$389K</div>
              </div>
              <div className="text-center">
                <span className="text-on-surface-variant/60">YoY</span>
                <div className="font-bold text-green-600">+5.1%</div>
              </div>
              <div className="text-center">
                <span className="text-on-surface-variant/60">Cap Rate</span>
                <div className="font-bold text-primary">6.2%</div>
              </div>
            </div>
            <p className="text-[10px] text-primary/70 mt-2 font-medium text-center">
              The deal is at the ZIP level. You just can&apos;t see it without
              Pro.
            </p>
          </div>
        </div>
      </div>
    </CollapsibleFeature>
  );
}
