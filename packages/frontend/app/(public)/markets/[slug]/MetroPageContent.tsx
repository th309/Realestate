"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { MetroSlugEntry } from "@/lib/data/metro-slugs";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
import { PersonaCaptureBlock } from "@/app/markets/components/PersonaCaptureBlock";
import { MarketOverviewSection } from "./MarketOverviewSection";
import { LeadMagnetModal } from "./components/LeadMagnetModal";
import MarketReportCTA from "../components/MarketReportCTA";
import { useMilestone } from "@/lib/hooks/useMilestone";

interface MetroPageContentProps {
  metro: MetroSlugEntry;
}

export function MetroPageContent({ metro }: MetroPageContentProps) {
  const [showLeadMagnet, setShowLeadMagnet] = useState(false);
  const { recordMilestone } = useMilestone();

  // Fire first_market_viewed after 5s dwell (intent: user actually read the page)
  useEffect(() => {
    const timer = setTimeout(
      () => void recordMilestone("first_market_viewed"),
      5000,
    );
    return () => clearTimeout(timer);
  }, [recordMilestone]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 overflow-x-hidden min-w-0">
      {/* Breadcrumb */}
      <nav
        className="text-sm text-on-surface-variant mb-6"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/markets" className="hover:text-primary">
          Markets
        </Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface font-medium">{metro.shortName}</span>
      </nav>

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3 break-words">
        {metro.shortName} Housing Market
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        AI-powered market intelligence for the {metro.name} metro area.
      </p>

      {/* Market report CTA — deep-link to the AI Report builder (geo-scale) */}
      <div className="mb-8">
        <MarketReportCTA
          geoLevel="metro"
          geoId={metro.cbsaCode}
          geoName={metro.shortName}
          stateAbbr={metro.state}
        />
      </div>

      {/* Scores */}
      <section
        className="mb-10"
        onMouseEnter={() => void recordMilestone("first_score_explored")}
      >
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          PropertyIQ Scores
        </h2>
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-2">
            <ScoreWidget
              geographyType="metro"
              geographyId={metro.cbsaCode}
              scoreType="propertyiq"
            />
            <span className="text-sm font-medium text-on-surface">
              PropertyIQ Score
            </span>
          </div>
        </div>
      </section>

      {/* AI Market Overview */}
      <MarketOverviewSection
        metroName={metro.shortName}
        cbsaCode={metro.cbsaCode}
      />

      {/* CTAs */}
      <section className="flex flex-wrap gap-4 mb-10">
        <Link
          href={`/map?geo=metro&id=${metro.cbsaCode}&name=${encodeURIComponent(metro.name)}&state=${metro.state}`}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
        >
          View on Interactive Map
        </Link>
        <Link
          href={`/market/${metro.cbsaCode}?type=metro`}
          className="px-6 py-3 bg-surface-container-low text-on-surface rounded-full font-medium border border-outline hover:bg-surface-container-high transition-colors"
        >
          Full Market Dashboard
        </Link>
        <button
          onClick={() => setShowLeadMagnet(true)}
          className="px-6 py-3 bg-tertiary-container text-on-tertiary-container rounded-full font-medium hover:bg-tertiary-container/80 transition-colors"
        >
          Get Free Market Report
        </button>
      </section>

      {/* Role-segmented persona capture */}
      <PersonaCaptureBlock geoName={metro.shortName} />

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            "@id": `https://www.propertyiq.app/markets/${metro.slug}#place`,
            name: metro.name,
            url: `https://www.propertyiq.app/markets/${metro.slug}`,
            containedInPlace: {
              "@type": "Country",
              name: "United States",
            },
          }),
        }}
      />

      {/* Lead Magnet Modal */}
      {showLeadMagnet && (
        <LeadMagnetModal
          metroName={metro.shortName}
          onClose={() => setShowLeadMagnet(false)}
        />
      )}
    </div>
  );
}
