"use client";

import type { ReportInstance } from "../../../../types";
import { getTemplate, type ReportTemplateType } from "../../templates";
import { SectionErrorBoundary } from "../../SectionErrorBoundary";
import { BrandingProvider } from "../../BrandingProvider";
import { type MarketBundle, syntheticMarketReport } from "./marketBundles";

/** The single-market template a 1-geo report of this user_type would use. */
function singleMarketTemplateType(report: ReportInstance): ReportTemplateType {
  return report.user_type === "investor" ? "investoredge_v2" : "homeready_v2";
}

/**
 * MarketDeepDivePanel — renders the REAL single-market report template for ONE
 * market, fed by a synthetic per-market report. So each comparison tab is the
 * exact full report that market would get on its own: same sections, same AI
 * narrative, same depth.
 *
 * Requires the backend to have generated this market's single-market narrative
 * (comparison reports generate one per market). If it isn't present yet (still
 * generating, or generation failed for this market), we show a clear notice
 * instead of empty narrative sections.
 */
export function MarketDeepDivePanel({
  report,
  bundle,
}: {
  report: ReportInstance;
  bundle: MarketBundle;
}) {
  if (!bundle.narrative) {
    return (
      <div className="py-12 text-center text-on-surface-variant">
        <p className="text-sm font-medium">
          A full report for {bundle.name} isn&apos;t available in this
          comparison.
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs">
          Per-market full reports are generated for new comparisons. Regenerate
          this comparison to get {bundle.name}&apos;s complete analysis.
        </p>
      </div>
    );
  }

  const synthetic = syntheticMarketReport(report, bundle);
  const sections =
    getTemplate(singleMarketTemplateType(report))?.sections ?? [];

  return (
    <BrandingProvider>
      {sections.map(({ component: Section, id }) => (
        <section key={id} id={`${bundle.id}-${id}`} className="mb-10">
          <SectionErrorBoundary sectionId={id}>
            <Section report={synthetic} />
          </SectionErrorBoundary>
        </section>
      ))}
    </BrandingProvider>
  );
}

export default MarketDeepDivePanel;
