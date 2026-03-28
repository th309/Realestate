"use client";

import { useState } from "react";
import { HorizonToggle } from "./HorizonToggle";
import { HeroStats } from "./HeroStats";
import { DollarImpactSection } from "./DollarImpactSection";
import { AlphaCallout } from "./AlphaCallout";
import { InteractiveScatter } from "./InteractiveScatter";
import { QuintilePerformance } from "./QuintilePerformance";
import { PearsonVsSpearman } from "./PearsonVsSpearman";
import { HeadToHead } from "./HeadToHead";
import { GeographyCoverage } from "./GeographyCoverage";
import { MethodologyFooter } from "./MethodologyFooter";
import { CTABanner } from "./CTABanner";

export function AccuracyPageShell() {
  const [horizon, setHorizon] = useState<"1y" | "3y">("3y");

  return (
    <div className="space-y-16">
      {/* 1. Hero Stats */}
      {/* @ts-expect-error horizon prop will be added in a later task */}
      <HeroStats horizon={horizon} />

      {/* 2. Dollar Impact */}
      <DollarImpactSection />

      {/* 2b. Alpha vs Beta Callout */}
      <AlphaCallout />

      {/* Horizon toggle — controls time window for the charts below */}
      <div className="flex justify-end px-4">
        <HorizonToggle value={horizon} onChange={setHorizon} />
      </div>

      {/* 3. Interactive Scatter */}
      {/* @ts-expect-error horizon prop will be added in a later task */}
      <InteractiveScatter horizon={horizon} />

      {/* 4. Quintile Performance */}
      {/* @ts-expect-error horizon prop will be added in a later task */}
      <QuintilePerformance horizon={horizon} />

      {/* 5. Pearson vs Spearman Explainer */}
      <PearsonVsSpearman />

      {/* 6. Head-to-Head Comparison */}
      <HeadToHead />

      {/* 7. Geography Coverage — shows both 1Y and 3Y, no horizon prop needed */}
      <GeographyCoverage />

      {/* 9. Methodology */}
      <MethodologyFooter />

      {/* 10. CTA */}
      <CTABanner />
    </div>
  );
}
