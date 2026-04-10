import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STATE_SLUG_DATA, SLUG_TO_STATE } from "@/lib/data/state-slug-data";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { COUNTY_SLUG_DATA } from "@/lib/data/county-slug-data";
import { ZIP_SLUG_DATA } from "@/lib/data/zip-slug-data";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";
import { StatePageContent } from "./StatePageContent";
import { generateStateSeoContent } from "./generate-seo-content";

export function generateStaticParams() {
  return STATE_SLUG_DATA.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const stateEntry = SLUG_TO_STATE.get(stateSlug);
  if (!stateEntry) return {};

  const pageUrl = `https://www.propertyiq.app/markets/state/${stateEntry.slug}`;
  const title = `Best Cities to Invest in ${stateEntry.name} — 2026 Real Estate Market`;
  const description = `Compare housing markets across ${stateEntry.name} — PropertyIQ scores, median home prices, rental yields, and AI-powered forecasts for every metro area and county. Find the best cities to invest in ${stateEntry.name} in 2026.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName: "PropertyIQ",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(stateEntry.name + " Real Estate")}`,
          width: 1200,
          height: 630,
          alt: `${stateEntry.name} Real Estate Market Analysis - PropertyIQ`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `/api/og?title=${encodeURIComponent(stateEntry.name + " Real Estate")}`,
      ],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours

export default async function StatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: stateSlug } = await params;
  const stateEntry = SLUG_TO_STATE.get(stateSlug);
  if (!stateEntry) notFound();

  const metros = METRO_SLUG_DATA.filter((m) => m.state === stateEntry.abbrev);
  const counties = COUNTY_SLUG_DATA.filter(
    (c) => c.state === stateEntry.abbrev,
  );

  // Filter zips to this state and group by cbsaCode and countyFips
  const stateZips = ZIP_SLUG_DATA.filter((z) => z.state === stateEntry.abbrev);

  const zipsByMetro = new Map<string, ZipSlugEntry[]>();
  const zipsByCounty = new Map<string, ZipSlugEntry[]>();

  for (const zip of stateZips) {
    if (zip.cbsaCode) {
      const group = zipsByMetro.get(zip.cbsaCode) ?? [];
      group.push(zip);
      zipsByMetro.set(zip.cbsaCode, group);
    }
    if (zip.countyFips) {
      const group = zipsByCounty.get(zip.countyFips) ?? [];
      group.push(zip);
      zipsByCounty.set(zip.countyFips, group);
    }
  }

  // Safe: JSON.stringify of server-built objects — no user input, consistent with
  // the same pattern used in /markets/[slug]/page.tsx and /markets/county/[slug]/page.tsx
  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.propertyiq.app" },
      { "@type": "ListItem", position: 2, name: "Markets", item: "https://www.propertyiq.app/markets" },
      { "@type": "ListItem", position: 3, name: stateEntry.name, item: `https://www.propertyiq.app/markets/state/${stateEntry.slug}` },
    ],
  });

  const stateSchemaJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "State",
    name: stateEntry.name,
    containedInPlace: { "@type": "Country", name: "United States" },
    url: `https://www.propertyiq.app/markets/state/${stateEntry.slug}`,
  });

  const seoContent = generateStateSeoContent(stateEntry.abbrev, stateEntry.name);
  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      {/* Safe JSON-LD injection — server-generated from trusted static data only */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stateSchemaJsonLd }} />

      <StatePageContent
        state={stateEntry}
        metros={metros}
        counties={counties}
      />

      {/* Server-rendered SEO content — crawlable without JS */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {stateEntry.name} Real Estate Market Analysis
        </h2>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <p>{seoContent.opening}</p>
          <p>{seoContent.economic}</p>
          <p>{seoContent.closing}</p>
        </div>

        {/* Metro Areas with ZIP codes — full hierarchy for crawlability */}
        {metros.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-medium text-on-surface mb-4">
              {stateEntry.name} Metro Areas and ZIP Codes
            </h3>
            <div className="space-y-6">
              {metros.map((metro) => {
                const metroZips = zipsByMetro.get(metro.cbsaCode) ?? [];
                return (
                  <div key={metro.cbsaCode}>
                    <a
                      href={`/markets/${metro.slug}`}
                      className="text-sm font-semibold text-on-surface hover:text-primary underline underline-offset-4"
                    >
                      {metro.shortName}
                    </a>
                    {metroZips.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {metroZips.map((zip) => (
                          <a
                            key={zip.zip}
                            href={`/markets/zip/${zip.slug}`}
                            className="text-xs text-primary/80 hover:text-primary underline underline-offset-2"
                          >
                            {zip.zip}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Counties with ZIP codes — full hierarchy for crawlability */}
        {counties.length > 0 && (
          <div className="mt-10">
            <h3 className="text-base font-medium text-on-surface mb-4">
              {stateEntry.name} Counties and ZIP Codes
            </h3>
            <div className="space-y-6">
              {counties.map((county) => {
                const countyZips = zipsByCounty.get(county.fips) ?? [];
                return (
                  <div key={county.fips}>
                    <a
                      href={`/markets/county/${county.slug}`}
                      className="text-sm font-semibold text-on-surface hover:text-primary underline underline-offset-4"
                    >
                      {county.shortName}
                    </a>
                    {countyZips.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {countyZips.map((zip) => (
                          <a
                            key={zip.zip}
                            href={`/markets/zip/${zip.slug}`}
                            className="text-xs text-primary/80 hover:text-primary underline underline-offset-2"
                          >
                            {zip.zip}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-8 text-xs text-on-surface-variant/60">
          Last updated: {today}. Data from Zillow, Realtor.com, Redfin, U.S.
          Census Bureau, FRED, BLS, and BEA.
        </p>
      </section>
    </>
  );
}
