"use client";

import { useState, type ReactNode } from "react";
import { HeroStats } from "./HeroStats";
import { DollarImpactSection } from "./DollarImpactSection";
import { AlphaCallout } from "./AlphaCallout";
import { InteractiveScatter } from "./InteractiveScatter";
import { QuintilePerformance } from "./QuintilePerformance";
import { CorrelationTimeline } from "./CorrelationTimeline";
import { PearsonVsSpearman } from "./PearsonVsSpearman";
import { GeographyCoverage } from "./GeographyCoverage";
import { MethodologyFooter } from "./MethodologyFooter";

interface AccuracyPageShellProps {
  children?: ReactNode;
}

export function AccuracyPageShell({ children }: AccuracyPageShellProps) {
  const [horizon, setHorizon] = useState<"1y" | "3y">("3y");

  return (
    <div className="space-y-16">
      {/* 1. Hero Stats */}
      <HeroStats horizon={horizon} />

      {/* 2. Dollar Impact */}
      <DollarImpactSection />

      {/* 2b. Alpha vs Beta Callout */}
      <AlphaCallout />

      {/* 3. Interactive Scatter (toggle inside, on OOS metrics row) */}
      <InteractiveScatter horizon={horizon} onHorizonChange={setHorizon} />

      {/* 4. Quintile Performance */}
      <QuintilePerformance horizon={horizon} />

      {/* 5. Correlation Timeline */}
      <CorrelationTimeline horizon={horizon} />

      {/* 6. Pearson vs Spearman Explainer */}
      <PearsonVsSpearman />

      {/* 7. Geography Coverage */}
      <GeographyCoverage />

      {/* 8. Methodology */}
      <MethodologyFooter />

      {children}
    </div>
  );
}
