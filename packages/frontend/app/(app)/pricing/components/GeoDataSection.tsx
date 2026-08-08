"use client";

import { MapPin, Check, Lock, ArrowRight } from "lucide-react";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { CollapsibleFeature } from "./CollapsibleFeature";
import { TierBadge } from "./TierBadge";
import { IllustrativeNote } from "./IllustrativeNote";

export function GeoDataSection() {
  return (
    <CollapsibleFeature
      id="data-depth"
      icon={<MapPin className="w-5 h-5 text-primary" />}
      title="County & ZIP Code Data"
      /* Pro unlocks the county and ZIP levels — NOT the all-levels total, which
         already includes the metros free users can see. */
      subtitle={`${COVERAGE_COPY.counties} counties and ${COVERAGE_COPY.zips} ZIP codes unlocked`}
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
              A metro can read flat while individual ZIP codes inside it run
              points ahead — or behind — on price and yield.
            </strong>
          </li>
          <li>
            You&apos;d never see that without drilling down. Pro unlocks{" "}
            {COVERAGE_COPY.counties} counties and {COVERAGE_COPY.zips} ZIP
            codes.
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
                {COVERAGE_COPY.metros} metro-level dashboards
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
              <div className="text-lg font-mono tabular-nums font-bold text-on-surface">
                $445K
              </div>
              <div className="text-xs font-mono tabular-nums text-green-600 font-medium">
                +3.2% YoY
              </div>
            </div>
          </div>
          <IllustrativeNote />
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
              <span className="text-on-surface">
                {COVERAGE_COPY.counties} county dashboards
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">
                {COVERAGE_COPY.zips} ZIP code dashboards
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
                <div className="font-mono tabular-nums font-bold text-on-surface">
                  $389K
                </div>
              </div>
              <div className="text-center">
                <span className="text-on-surface-variant/60">YoY</span>
                <div className="font-mono tabular-nums font-bold text-green-600">
                  +5.1%
                </div>
              </div>
              <div className="text-center">
                <span className="text-on-surface-variant/60">Cap Rate</span>
                <div className="font-mono tabular-nums font-bold text-primary">
                  6.2%
                </div>
              </div>
            </div>
            <p className="text-[10px] text-primary/70 mt-2 font-medium text-center">
              The deal is at the ZIP level. You just can&apos;t see it without
              Pro.
            </p>
          </div>
          <IllustrativeNote />
        </div>
      </div>
    </CollapsibleFeature>
  );
}
