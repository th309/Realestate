"use client";

import type { AnonReportResponse } from "@/lib/data";
import { ListingPresentationCover } from "./ListingPresentationCover";
import { ExecutiveSummary } from "./listing-sections/ExecutiveSummary";
import { MarketNow } from "./listing-sections/MarketNow";
import { Trajectory } from "./listing-sections/Trajectory";
import { Forecast } from "./listing-sections/Forecast";
import { Peers } from "./listing-sections/Peers";
import { Migration } from "./listing-sections/Migration";
import { Affordability } from "./listing-sections/Affordability";
import { Employment } from "./listing-sections/Employment";
import { Validation } from "./listing-sections/Validation";
import { AiStrategy } from "./listing-sections/AiStrategy";

interface Props {
  report: AnonReportResponse;
  marketName: string;
  geographyDescription: string;
  households?: number;
  showWatermark: boolean;
}

interface SectionLike {
  id: string;
  data: unknown;
  limitedData: boolean;
}

function pickSection(
  sections: SectionLike[],
  id: string,
): SectionLike | undefined {
  return sections.find((s) => s.id === id);
}

function dataOf(section: SectionLike | undefined): unknown {
  return section?.data ?? {};
}

export function ListingPresentation({
  report,
  marketName,
  geographyDescription,
  households,
  showWatermark,
}: Props) {
  const sections = report.report.sections as SectionLike[];

  // Each section component reads its own slice. The orchestration here just
  // unpacks the API response into props the sections expect. Mapping logic
  // for shape transforms (e.g., raw Redfin metric → display label) lives in
  // the section component, NOT here, to keep this assembly file thin.
  const exec = pickSection(sections, "executive-summary");
  const market = pickSection(sections, "market-now");
  const traj = pickSection(sections, "trajectory-12mo");
  const fc = pickSection(sections, "forecast");
  const peers = pickSection(sections, "peers");
  const mig = pickSection(sections, "migration");
  const aff = pickSection(sections, "affordability");
  const emp = pickSection(sections, "employment");
  const val = pickSection(sections, "validation");
  const ai = pickSection(sections, "ai-strategy");

  const aiData = dataOf(ai);
  const aiFallbackUsed = Boolean(
    (aiData as { fallbackUsed?: unknown } | null | undefined)?.fallbackUsed,
  );

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-[0_12px_40px_rgba(57,73,171,0.18)] ring-1 ring-primary-container">
      <ListingPresentationCover
        marketName={marketName}
        geographyDescription={geographyDescription}
        households={households}
        generatedAt={new Date().toISOString()}
      />

      {showWatermark && (
        <div
          data-print-hide="true"
          className="flex items-center justify-between border-b border-warning/30 bg-warning-container px-12 py-2.5 text-[12px] text-on-warning-container"
        >
          <span>
            <strong>Demo report</strong> — sign up free below to save, share,
            brand it with your photo, and remove this banner.
          </span>
          <a
            href="#signup-cta"
            className="font-semibold text-on-primary-container no-underline"
          >
            Save my report →
          </a>
        </div>
      )}

      <ExecutiveSummary
        {...(dataOf(exec) as React.ComponentProps<typeof ExecutiveSummary>)}
        limitedData={!!exec?.limitedData}
      />
      <MarketNow
        {...(dataOf(market) as React.ComponentProps<typeof MarketNow>)}
        limitedData={!!market?.limitedData}
      />
      <Trajectory
        {...(dataOf(traj) as React.ComponentProps<typeof Trajectory>)}
        limitedData={!!traj?.limitedData}
      />
      <Forecast
        {...(dataOf(fc) as React.ComponentProps<typeof Forecast>)}
        limitedData={!!fc?.limitedData}
      />
      <Peers
        {...(dataOf(peers) as React.ComponentProps<typeof Peers>)}
        limitedData={!!peers?.limitedData}
      />
      <Migration
        {...(dataOf(mig) as React.ComponentProps<typeof Migration>)}
        limitedData={!!mig?.limitedData}
      />
      <Affordability
        {...(dataOf(aff) as React.ComponentProps<typeof Affordability>)}
        limitedData={!!aff?.limitedData}
      />
      <Employment
        {...(dataOf(emp) as React.ComponentProps<typeof Employment>)}
        limitedData={!!emp?.limitedData}
      />
      <Validation
        {...(dataOf(val) as React.ComponentProps<typeof Validation>)}
        limitedData={!!val?.limitedData}
      />
      <AiStrategy
        {...(aiData as React.ComponentProps<typeof AiStrategy>)}
        fallbackUsed={aiFallbackUsed}
      />

      <footer className="border-t border-outline-variant/40 bg-surface-container px-12 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Data sources &amp; methodology
        </p>
        <p className="mt-1.5 text-[11px] leading-[1.7] text-on-surface-variant">
          <strong className="text-on-surface">Zillow ZHVI</strong>,{" "}
          <strong className="text-on-surface">Redfin Market Tracker</strong>,{" "}
          <strong className="text-on-surface">U.S. Census ACS 5-Year</strong>,{" "}
          <strong className="text-on-surface">FRED / BEA</strong>,{" "}
          <strong className="text-on-surface">BLS QCEW</strong>,{" "}
          <strong className="text-on-surface">
            IRS Statistics of Income migration data
          </strong>
          , <strong className="text-on-surface">PropertyIQ Score v4</strong>{" "}
          (proprietary, validated quarterly). Forecasts use PropertyIQ's
          time-series model with 80% confidence intervals. Validation
          methodology at /scores/accuracy.
        </p>
      </footer>
    </article>
  );
}
