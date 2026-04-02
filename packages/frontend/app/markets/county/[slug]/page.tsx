import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { COUNTY_SLUG_DATA, SLUG_TO_COUNTY } from "@/lib/data/county-slug-data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { CountyPageContent } from "./CountyPageContent";
import { generateCountySeoContent } from "./generate-seo-content";

export function generateStaticParams() {
  return COUNTY_SLUG_DATA.map((county) => ({ slug: county.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) return {};

  const pageUrl = `https://www.propertyiq.app/markets/county/${county.slug}`;
  const ogImageUrl = `/api/og?title=${encodeURIComponent(county.shortName)}`;

  return {
    title: `${county.shortName} Housing Market — 2026 Analysis`,
    description: `${county.shortName} housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends. Updated 2026.`,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${county.shortName} Housing Market — 2026 Analysis | PropertyIQ`,
      description: `${county.shortName} housing market data — home prices, demand scores, investment analysis. Updated 2026.`,
      siteName: "PropertyIQ",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${county.shortName} Housing Market Analysis`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${county.shortName} Housing Market — 2026 Analysis`,
      description: `${county.shortName} housing market data — demand scores, home prices, investment analysis. Updated 2026.`,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours

export default async function CountyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) notFound();

  // Find parent metro for cross-linking
  const parentMetro = county.cbsaCode
    ? CBSA_TO_METRO.get(county.cbsaCode)
    : null;

  // Find neighboring counties in the same state
  const nearbyCounties = COUNTY_SLUG_DATA.filter(
    (c) => c.state === county.state && c.fips !== county.fips,
  ).slice(0, 6);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.propertyiq.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Markets",
        item: "https://www.propertyiq.app/markets",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: county.shortName,
        item: `https://www.propertyiq.app/markets/county/${county.slug}`,
      },
    ],
  };

  const seoContent = generateCountySeoContent(county);
  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      {/* Breadcrumb structured data - server-generated from trusted county data */}
      <script
        type="application/ld+json"
        // Safe: JSON.stringify of a server-built object with no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <CountyPageContent
        county={county}
        parentMetroSlug={parentMetro?.slug ?? null}
        parentMetroName={parentMetro?.shortName ?? null}
      />

      {/* Server-rendered SEO content */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {county.shortName} Housing Market Overview
        </h2>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <p>{seoContent.opening}</p>
          <p>{seoContent.regional}</p>
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        {/* Nearby counties for internal linking */}
        {nearbyCounties.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-medium text-on-surface mb-3">
              Other {county.state} Counties
            </h3>
            <div className="flex flex-wrap gap-2">
              {nearbyCounties.map((c) => (
                <Link
                  key={c.fips}
                  href={`/markets/county/${c.slug}`}
                  className="text-sm text-primary hover:text-primary/80 underline underline-offset-4"
                >
                  {c.shortName}
                </Link>
              ))}
            </div>
          </div>
        )}

        {parentMetro && (
          <p className="mt-6 text-sm text-on-surface-variant">
            {county.shortName} is part of the{" "}
            <Link
              href={`/markets/${parentMetro.slug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentMetro.shortName} metro area
            </Link>
            .
          </p>
        )}

        <p className="mt-8 text-xs text-on-surface-variant/60">
          Last updated: {today}. Data from Zillow, Realtor.com, Redfin, U.S.
          Census Bureau, FRED, BLS, and BEA.
        </p>
      </section>
    </>
  );
}
