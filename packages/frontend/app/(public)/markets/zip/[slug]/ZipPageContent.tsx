"use client";

import Link from "next/link";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";
import { ScoreGaugeWidget } from "@/app/components/scoring/ScoreGaugeWidget";
import { PersonaCaptureBlock } from "@/app/markets/components/PersonaCaptureBlock";
import MarketReportCTA from "../../components/MarketReportCTA";

interface ZipPageContentProps {
  zip: ZipSlugEntry;
  parentMetroSlug: string | null;
  parentMetroName: string | null;
  parentCountySlug: string | null;
  parentCountyName: string | null;
}

export function ZipPageContent({
  zip,
  parentMetroSlug,
  parentMetroName,
  parentCountySlug,
  parentCountyName,
}: ZipPageContentProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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
        <span className="text-on-surface font-medium">{zip.shortName}</span>
      </nav>

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        {zip.shortName} Housing Market
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Hyperlocal market intelligence for ZIP code {zip.zip} in {zip.state}.
        {parentCountyName && (
          <>
            {" "}
            Located in{" "}
            <Link
              href={`/markets/county/${parentCountySlug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentCountyName}
            </Link>
            .
          </>
        )}
        {parentMetroName && (
          <>
            {" "}
            Part of the{" "}
            <Link
              href={`/markets/${parentMetroSlug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentMetroName}
            </Link>{" "}
            metro area.
          </>
        )}
      </p>

      {/* Market report CTA — deep-link to the AI Report builder (geo-scale) */}
      <div className="mb-8">
        <MarketReportCTA
          geoLevel="zip"
          geoId={zip.zip}
          geoName={zip.shortName}
          stateAbbr={zip.state}
        />
      </div>

      {/* Score */}
      <section className="mb-10 flex justify-center">
        <ScoreGaugeWidget
          geographyType="zip"
          geographyId={zip.zip}
          scoreType="propertyiq"
        />
      </section>

      {/* CTAs */}
      <section className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          href={`/map?geo=zip&region=${zip.zip}`}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          View on Map
        </Link>
        <Link
          href="/reports"
          className="flex items-center justify-center gap-2 px-6 py-3 border border-primary text-primary rounded-xl font-medium hover:bg-primary/10 transition-colors"
        >
          Generate AI Report
        </Link>
      </section>

      {/* Role-segmented persona capture */}
      <PersonaCaptureBlock geoName={zip.shortName} />
    </div>
  );
}
