"use client";

import type { ReportInstance } from "../../../../types";
import { SectionProps } from "../../types";
import { getTemplate } from "../../templates";
import { SectionErrorBoundary } from "../../SectionErrorBoundary";
import { BrandingProvider } from "../../BrandingProvider";
import { buildMarketBundles } from "./marketBundles";
import {
  COMPARISON_SECTIONS,
  SCORE_DRIVER_SECTION,
} from "./comparisonSections";
import { ComparisonVerdictHeader } from "./ComparisonVerdictHeader";
import { ComparisonMetricTable } from "./ComparisonMetricTable";
import { ComparisonNews } from "./ComparisonNews";
import { ComparisonDeepDiveAccordion } from "./ComparisonDeepDiveAccordion";

/**
 * ComparisonReportV3 — a TRUE side-by-side market comparison (2–4 markets),
 * structured like the single-market report but comparative throughout:
 *
 *   1. Verdict header — every market's live PropertyIQ score, grade, momentum.
 *   2. AI head-to-head synthesis — when present (auto-hides if the report was
 *      generated without ai_insights; the data below stands on its own).
 *   3. "What's driving the scores" — the four score inputs, side by side.
 *   4. Report-mirroring metric tables — Price & Value, Market Conditions,
 *      Economy & Affordability — markets across, leader per row highlighted.
 *   5. Recent news across every market.
 *   6. A collapsed drawer with each market's FULL single-market report.
 *
 * The comparison is built entirely from data every market already carries
 * (`current` metrics + live score), so it's complete with or without AI prose.
 */
export function ComparisonReportV3({ report }: Pick<SectionProps, "report">) {
  const r = report as ReportInstance;
  const bundles = buildMarketBundles(r);

  if (bundles.length < 2) {
    return (
      <p className="py-8 text-center text-on-surface-variant">
        Add a comparison market to see the side-by-side comparison.
      </p>
    );
  }

  // The written head-to-head synthesis (exec verdict / head-to-head / scenario
  // analysis). Drops the single-market "market-pulse" — ComparisonNews below
  // shows every market's news, not just the primary's.
  const synthesisSections = (
    getTemplate("comparison_v2")?.sections ?? []
  ).filter((s) => s.id !== "market-pulse");

  return (
    <div>
      {/* 1. Verdict header — the score comparison at a glance */}
      <ComparisonVerdictHeader markets={bundles} />

      {/* 2. Written head-to-head synthesis (auto-hides when absent) */}
      <BrandingProvider>
        {synthesisSections.map(({ component: Section, id }) => (
          <section key={id} id={id} className="mb-10">
            <SectionErrorBoundary sectionId={id}>
              <Section report={r} />
            </SectionErrorBoundary>
          </section>
        ))}
      </BrandingProvider>

      {/* 3. Why the scores differ — the four PropertyIQ drivers side by side */}
      <ComparisonMetricTable markets={bundles} section={SCORE_DRIVER_SECTION} />

      {/* 4. Report-mirroring side-by-side metric tables */}
      {COMPARISON_SECTIONS.map((section) => (
        <ComparisonMetricTable
          key={section.id}
          markets={bundles}
          section={section}
        />
      ))}

      {/* 5. News for every market */}
      <ComparisonNews markets={bundles} />

      {/* 6. Full per-market reports — demoted to an opt-in drawer */}
      <ComparisonDeepDiveAccordion report={r} bundles={bundles} />
    </div>
  );
}

export default ComparisonReportV3;
