"use client";

import Link from "next/link";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
import { NewsletterSignup } from "@/components/newsletter/NewsletterSignup";
import AnalyzeCTA from "../../components/AnalyzeCTA";

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

      {/* Analyze CTA — deep-link to Deal Analyzer */}
      <div className="mb-8">
        <AnalyzeCTA geoLevel="zip" geoId={zip.zip} geoName={zip.shortName} />
      </div>

      {/* Score */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          PropertyIQ Score
        </h2>
        <ScoreWidget
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

      {/* Newsletter */}
      <section className="mb-10">
        <NewsletterSignup
          source="city-page"
          label="Get monthly score updates for this ZIP code"
          description="Stay informed when the PropertyIQ score for this ZIP code changes."
        />
      </section>
    </div>
  );
}
