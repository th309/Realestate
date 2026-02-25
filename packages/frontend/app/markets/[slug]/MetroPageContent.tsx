'use client';

import Link from 'next/link';
import type { MetroSlugEntry } from '@/lib/data/metro-slugs';
import { METRO_SLUG_DATA } from '@/lib/data/metro-slug-data';
import { ScoreWidget } from '@/app/components/scoring/ScoreWidget';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';

interface MetroPageContentProps {
  metro: MetroSlugEntry;
}

export function MetroPageContent({ metro }: MetroPageContentProps) {
  const nearbyMetros = METRO_SLUG_DATA
    .filter(m => m.state === metro.state && m.cbsaCode !== metro.cbsaCode)
    .slice(0, 5);

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
        <span className="text-on-surface font-medium">{metro.shortName}</span>
      </nav>

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        {metro.shortName} Housing Market Analysis
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        AI-powered market intelligence for the {metro.name} metro area.
      </p>

      {/* Scores */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          PropertyIQ Scores
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2">
            <ScoreWidget
              geographyType="metro"
              geographyId={metro.cbsaCode}
              scoreType="homeready"
            />
            <span className="text-sm font-medium text-on-surface">HomeReady</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ScoreWidget
              geographyType="metro"
              geographyId={metro.cbsaCode}
              scoreType="investoredge"
            />
            <span className="text-sm font-medium text-on-surface">InvestorEdge</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ScoreWidget
              geographyType="metro"
              geographyId={metro.cbsaCode}
              scoreType="market_health"
            />
            <span className="text-sm font-medium text-on-surface">Market Health</span>
          </div>
        </div>
      </section>

      {/* CTAs */}
      <section className="flex flex-wrap gap-4 mb-10">
        <Link
          href={`/map?geo=metro&region=${metro.cbsaCode}`}
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
      </section>

      {/* Newsletter Signup */}
      <NewsletterSignup />

      {/* Nearby Markets (internal linking) */}
      {nearbyMetros.length > 0 && (
        <section className="mt-10 pt-8 border-t border-outline-variant">
          <h2 className="text-xl font-semibold text-on-surface mb-4">
            More Markets in {metro.state}
          </h2>
          <div className="flex flex-wrap gap-2">
            {nearbyMetros.map(m => (
              <Link
                key={m.cbsaCode}
                href={`/markets/${m.slug}`}
                className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm hover:bg-surface-container-high transition-colors"
              >
                {m.shortName}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: metro.name,
            url: `https://www.propertyiq.app/markets/${metro.slug}`,
            containedInPlace: {
              '@type': 'Country',
              name: 'United States',
            },
          }),
        }}
      />
    </div>
  );
}
