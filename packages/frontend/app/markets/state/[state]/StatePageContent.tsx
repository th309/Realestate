"use client";

import Link from "next/link";
import type { StateSlugEntry } from "@/lib/data/state-slug-data";
import type { MetroSlugEntry } from "@/lib/data/metro-slugs";
import type { CountySlugEntry } from "@/lib/data/county-slugs";

interface StatePageContentProps {
  state: StateSlugEntry;
  metros: MetroSlugEntry[];
  counties: CountySlugEntry[];
}

export function StatePageContent({
  state,
  metros,
  counties,
}: StatePageContentProps) {
  const topMetros = metros.slice(0, 12);
  const topCounties = counties.slice(0, 12);

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
        <span className="text-on-surface font-medium">{state.name}</span>
      </nav>

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        {state.name} Real Estate Market
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        AI-powered housing market analysis for every metro area and county in{" "}
        {state.name}. Updated monthly with the latest data from Zillow, Redfin,
        Census, and FRED.
      </p>

      {/* CTAs */}
      <section className="flex flex-wrap gap-4 mb-10">
        <Link
          href={`/map?state=${state.abbrev}`}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
        >
          View {state.abbrev} on Map
        </Link>
        <Link
          href="/scores"
          className="px-6 py-3 border border-outline text-on-surface rounded-full font-medium hover:bg-surface-variant transition-colors"
        >
          Compare All Markets
        </Link>
      </section>

      {/* Metro Areas */}
      {topMetros.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-on-surface mb-2">
            {state.name} Metro Areas
          </h2>
          <p className="text-on-surface-variant text-sm mb-5">
            {metros.length} metropolitan areas tracked by PropertyIQ in{" "}
            {state.name}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {topMetros.map((metro) => (
              <Link
                key={metro.cbsaCode}
                href={`/markets/${metro.slug}`}
                className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="text-sm font-medium text-on-surface">
                  {metro.shortName}
                </span>
              </Link>
            ))}
          </div>
          {metros.length > 12 && (
            <p className="mt-4 text-sm text-on-surface-variant">
              +{metros.length - 12} more metro areas in {state.name} tracked by
              PropertyIQ
            </p>
          )}
        </section>
      )}

      {/* Counties */}
      {topCounties.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-on-surface mb-2">
            {state.name} Counties
          </h2>
          <p className="text-on-surface-variant text-sm mb-5">
            {counties.length} counties tracked by PropertyIQ in {state.name}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {topCounties.map((county) => (
              <Link
                key={county.fips}
                href={`/markets/county/${county.slug}`}
                className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="text-sm font-medium text-on-surface">
                  {county.name}
                </span>
              </Link>
            ))}
          </div>
          {counties.length > 12 && (
            <p className="mt-4 text-sm text-on-surface-variant">
              +{counties.length - 12} more counties in {state.name} tracked by
              PropertyIQ
            </p>
          )}
        </section>
      )}

      {/* Explore more CTA */}
      <section className="bg-surface-variant rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-on-surface mb-1">
            Get AI-Powered Market Analysis
          </h3>
          <p className="text-sm text-on-surface-variant">
            PropertyIQ scores every {state.name} market on 40+ indicators.
            Sign up free to unlock the full dashboard.
          </p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Get Started Free
        </Link>
      </section>
    </div>
  );
}
