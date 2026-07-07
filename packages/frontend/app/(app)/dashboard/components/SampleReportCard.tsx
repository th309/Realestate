"use client";

import Link from "next/link";
import { useEntitlements } from "@/lib/entitlements";
import { useScoreData } from "@/lib/data";
import type { GeoLevel } from "@/lib/data";

const FALLBACK_MARKET = {
  geoLevel: "metro" as const,
  geoId: "40380",
  name: "Rochester, NY",
};

interface SampleReportCardProps {
  onboardingMarket: { geoLevel: string; geoId: string; name: string } | null;
}

export function SampleReportCard({ onboardingMarket }: SampleReportCardProps) {
  const { trial, tier } = useEntitlements();
  const market = onboardingMarket ?? FALLBACK_MARKET;

  const { propertyiq } = useScoreData(
    market.geoLevel as GeoLevel,
    market.geoId,
    { enabled: tier === "free" && !trial?.active },
  );
  const score = propertyiq?.score ?? null;

  if (trial?.active || tier !== "free") return null;

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/30 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-on-surface">
            Sample Report: {market.name}
          </h3>
          {score != null && (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold font-mono text-primary">
                {score}
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
          See what a full PropertyIQ AI report looks like — market analysis,
          investment insights, and trend forecasts powered by real-time data.
        </p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <span className="text-xs text-primary font-medium">Pro</span>
            <span className="text-xs text-on-surface-variant">
              Unlock monthly trend updates for {market.name}
            </span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <span className="text-xs text-primary font-medium">Pro</span>
            <span className="text-xs text-on-surface-variant">
              Get ZIP-level analysis and competitive breakdown
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/reports?market=${market.geoId}&type=${market.geoLevel}`}
            className="flex-1 text-center py-2.5 px-4 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Generate Free Report
          </Link>
          <Link
            href="/pricing?from=sample_report"
            className="py-2.5 px-4 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/8 transition-colors"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
