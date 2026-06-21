"use client";

import { useState } from "react";
import { PillTabs } from "@/components/ui/Tabs";
import type { ReportInstance } from "../../../../types";
import { SectionProps } from "../../types";
import { getTemplate } from "../../templates";
import { SectionErrorBoundary } from "../../SectionErrorBoundary";
import { BrandingProvider } from "../../BrandingProvider";
import { buildMarketBundles, shortMarketName } from "./marketBundles";
import { ComparisonSummaryV3 } from "./ComparisonSummaryV3";
import { ComparisonNews } from "./ComparisonNews";
import { MarketDeepDivePanel } from "./MarketDeepDivePanel";

/**
 * ComparisonReportV3 — the whole comparison report in one section:
 *   1. an at-a-glance scoreboard (live PropertyIQ score per market, winner),
 *   2. the SYNTHESIZED written comparison (the comparison narrative — exec
 *      verdict / head-to-head / scenario analysis), then
 *   3. frozen tabs (one per market) that each render that market's FULL
 *      single-market report in depth (same template + AI narrative it would get
 *      on its own), via a synthetic per-market report.
 *
 * The template registry types section components as ComponentType<{ report }>
 * (no required `section`), so accept just the report slice of SectionProps.
 */
export function ComparisonReportV3({ report }: Pick<SectionProps, "report">) {
  const r = report as ReportInstance;
  const bundles = buildMarketBundles(r);
  const [activeId, setActiveId] = useState(bundles[0]?.id ?? "");

  if (bundles.length < 2) {
    return (
      <p className="py-8 text-center text-on-surface-variant">
        Add a comparison market to see the side-by-side comparison.
      </p>
    );
  }

  const active = bundles.find((b) => b.id === activeId) ?? bundles[0];
  // The summary = the comparison synthesis sections (read report.ai_narrative).
  // Drop the single-market "market-pulse" — it shows ONLY the primary's news;
  // ComparisonNews below shows every market's news instead.
  const synthesisSections = (
    getTemplate("comparison_v2")?.sections ?? []
  ).filter((s) => s.id !== "market-pulse");

  return (
    <div>
      {/* 1. At-a-glance scoreboard */}
      <ComparisonSummaryV3 markets={bundles} />

      {/* 2. Synthesized written comparison */}
      <BrandingProvider>
        {synthesisSections.map(({ component: Section, id }) => (
          <section key={id} id={id} className="mb-10">
            <SectionErrorBoundary sectionId={id}>
              <Section report={r} />
            </SectionErrorBoundary>
          </section>
        ))}
      </BrandingProvider>

      {/* News for EVERY market (replaces the primary-only Market Pulse) */}
      <ComparisonNews markets={bundles} />

      {/* 3. Each market in depth — frozen tabs + full single-market report */}
      <div className="mt-6">
        <h2 className="report-heading-lg mb-1 text-on-surface">
          Each market in depth
        </h2>
        <p className="mb-3 text-sm text-on-surface-variant">
          The full report for each market — pick one to read it.
        </p>
        <div className="sticky top-0 z-20 -mx-4 border-b border-outline-variant/40 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <PillTabs
            options={bundles.map((b) => ({
              value: b.id,
              label: shortMarketName(b.name),
            }))}
            value={active.id}
            onChange={setActiveId}
          />
        </div>
        <div className="mt-6">
          <MarketDeepDivePanel report={r} bundle={active} />
        </div>
      </div>
    </div>
  );
}

export default ComparisonReportV3;
