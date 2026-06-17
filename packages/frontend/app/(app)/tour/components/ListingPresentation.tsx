"use client";

import { Fragment } from "react";
import type { AnonReportResponse } from "@/lib/data";
import { CBSA_TO_METRO } from "@/lib/data";
import { ReportHero } from "./ReportHero";
import type { HeroBundle } from "./listing-sections/adapt-hero";
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
import {
  adaptReportSections,
  type RawSection,
} from "./listing-sections/adapt-sections";

interface Props {
  report: AnonReportResponse;
  marketName: string;
  geographyDescription: string;
  households?: number;
  showWatermark: boolean;
}

export function ListingPresentation({
  report,
  marketName,
  showWatermark,
}: Props) {
  // The backend emits a different `data` shape per section than the components
  // consume; `adaptReportSections` reconciles the contract DEFENSIVELY (any
  // empty/mismatched section degrades to limitedData instead of crashing).
  const s = adaptReportSections(report.report.sections as RawSection[]);
  const hero = s.hero as unknown as HeroBundle;
  // Prefer the server-resolved market name (from the report data); fall back to
  // the client-passed name. If that is still a bare CBSA geoId (bare-URL / anon
  // entry), resolve it to a real metro name from the bundled crosswalk so the
  // hero never shows a number.
  const rawName = hero.marketName || marketName;
  const resolvedName = /^\d{5}$/.test(rawName)
    ? (CBSA_TO_METRO.get(rawName)?.shortName ?? rawName)
    : rawName;

  // THE single source of truth for the body's section order, visibility, and
  // numbering. Per the no-empty-sections rule, any section the adapter flagged
  // `limitedData` is DROPPED entirely (never rendered as a "Limited data" stub),
  // and the survivors are renumbered 01..N so the reader never sees a gap like
  // "01 … 03 … 07". The adapter's `limitedData` is a faithful proxy for "this
  // component will render content," so this filter never strands a blank number.
  const isLimited = (p: Record<string, unknown>) => p.limitedData === true;
  const orderedSections: {
    key: string;
    limited: boolean;
    render: (num: string) => React.ReactElement;
  }[] = [
    {
      key: "exec",
      limited: isLimited(s.exec),
      render: (num) => (
        <ExecutiveSummary
          {...(s.exec as unknown as React.ComponentProps<
            typeof ExecutiveSummary
          >)}
          num={num}
        />
      ),
    },
    {
      key: "market",
      limited: isLimited(s.market),
      render: (num) => (
        <MarketNow
          {...(s.market as unknown as React.ComponentProps<typeof MarketNow>)}
          num={num}
        />
      ),
    },
    {
      key: "traj",
      limited: isLimited(s.traj),
      render: (num) => (
        <Trajectory
          {...(s.traj as unknown as React.ComponentProps<typeof Trajectory>)}
          num={num}
        />
      ),
    },
    {
      key: "fc",
      limited: isLimited(s.fc),
      render: (num) => (
        <Forecast
          {...(s.fc as unknown as React.ComponentProps<typeof Forecast>)}
          num={num}
        />
      ),
    },
    {
      key: "peers",
      limited: isLimited(s.peers),
      render: (num) => (
        <Peers
          {...(s.peers as unknown as React.ComponentProps<typeof Peers>)}
          num={num}
        />
      ),
    },
    {
      key: "mig",
      limited: isLimited(s.mig),
      render: (num) => (
        <Migration
          {...(s.mig as unknown as React.ComponentProps<typeof Migration>)}
          num={num}
        />
      ),
    },
    {
      key: "aff",
      limited: isLimited(s.aff),
      render: (num) => (
        <Affordability
          {...(s.aff as unknown as React.ComponentProps<typeof Affordability>)}
          num={num}
        />
      ),
    },
    {
      key: "emp",
      limited: isLimited(s.emp),
      render: (num) => (
        <Employment
          {...(s.emp as unknown as React.ComponentProps<typeof Employment>)}
          num={num}
        />
      ),
    },
    {
      key: "val",
      limited: isLimited(s.val),
      render: (num) => (
        <Validation
          {...(s.val as unknown as React.ComponentProps<typeof Validation>)}
          num={num}
        />
      ),
    },
    {
      key: "ai",
      limited: isLimited(s.ai),
      render: (num) => (
        <AiStrategy
          {...(s.ai as unknown as React.ComponentProps<typeof AiStrategy>)}
          num={num}
        />
      ),
    },
  ];
  const visibleSections = orderedSections.filter((sec) => !sec.limited);

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-[0_12px_40px_rgba(57,73,171,0.18)] ring-1 ring-primary-container">
      <ReportHero
        marketName={resolvedName}
        score={hero.score}
        verdict={hero.verdict}
        kpis={hero.kpis}
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

      {visibleSections.map((sec, i) => (
        <Fragment key={sec.key}>
          {sec.render(String(i + 1).padStart(2, "0"))}
        </Fragment>
      ))}

      <footer className="border-t border-outline-variant/40 bg-surface-container px-12 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Data sources &amp; methodology
        </p>
        <p className="mt-1.5 text-[11px] leading-[1.7] text-on-surface-variant">
          <strong className="text-on-surface">Zillow ZHVI &amp; ZHVF</strong>,{" "}
          <strong className="text-on-surface">Realtor.com</strong>,{" "}
          <strong className="text-on-surface">U.S. Census ACS 5-Year</strong>,{" "}
          <strong className="text-on-surface">FRED / BEA</strong>,{" "}
          <strong className="text-on-surface">BLS QCEW</strong>,{" "}
          <strong className="text-on-surface">
            IRS Statistics of Income migration data
          </strong>
          , <strong className="text-on-surface">PropertyIQ Score</strong>{" "}
          (proprietary, validated out-of-sample). Forecasts use Zillow&apos;s
          home-value forecast with a modeled 80% interval derived from each
          market&apos;s historical volatility. Validation methodology at
          /scores/accuracy.
        </p>
      </footer>
    </article>
  );
}
