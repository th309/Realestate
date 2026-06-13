import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ZIP_SLUG_DATA, SLUG_TO_ZIP } from "@/lib/data/zip-slug-data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { FIPS_TO_COUNTY } from "@/lib/data/county-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { ZipPageContent } from "./ZipPageContent";
import { generateZipSeoContent } from "./generate-seo-content";

export function generateStaticParams() {
  return ZIP_SLUG_DATA.map((zip) => ({ slug: zip.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const zip = SLUG_TO_ZIP.get(slug);
  if (!zip) return {};

  const cityState = zip.shortName.replace(`${zip.zip}, `, "");
  const pageUrl = `https://www.propertyiq.app/markets/zip/${zip.slug}`;
  const ogImageUrl = `/api/og?title=${encodeURIComponent(zip.shortName)}`;

  return {
    title: `${zip.zip} ${cityState} Housing Market — 2026 Analysis`,
    description: `${zip.shortName} housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends at the ZIP code level. Updated 2026.`,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${zip.zip} ${cityState} Housing Market — 2026 Analysis | PropertyIQ`,
      description: `${zip.shortName} housing market data — home prices, demand scores, investment analysis. Updated 2026.`,
      siteName: "PropertyIQ",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${zip.shortName} Housing Market Analysis`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${zip.zip} ${cityState} Housing Market — 2026 Analysis`,
      description: `${zip.shortName} housing market data — demand scores, home prices, investment analysis. Updated 2026.`,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours

export default async function ZipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const zip = SLUG_TO_ZIP.get(slug);
  if (!zip) notFound();

  // Find parent metro for cross-linking
  const parentMetro = zip.cbsaCode ? CBSA_TO_METRO.get(zip.cbsaCode) : null;

  // Find parent county for cross-linking
  const parentCounty = zip.countyFips
    ? FIPS_TO_COUNTY.get(zip.countyFips)
    : null;

  // Nearby ZIPs in the same state, ranked by PropertyIQ score.
  const zipRank = await fetchRankings("propertyiq", "zip", {
    state: zip.state,
    limit: 12,
  });
  const zipByCode = new Map(ZIP_SLUG_DATA.map((z) => [z.zip, z]));
  const rankedZips = zipRank
    .filter((r) => r.id !== zip.zip && zipByCode.has(r.id))
    .map((r) => zipByCode.get(r.id)!)
    .slice(0, 6);
  const nearbyZips = rankedZips.length
    ? rankedZips
    : ZIP_SLUG_DATA.filter(
        (z) => z.state === zip.state && z.zip !== zip.zip,
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
        name: zip.shortName,
        item: `https://www.propertyiq.app/markets/zip/${zip.slug}`,
      },
    ],
  };

  const seoContent = generateZipSeoContent(zip);

  const stats = await fetchSeoMarketStats("zip", zip.zip, zip.state);

  return (
    <>
      {/* Safe: JSON.stringify of a server-built object with no user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ZipPageContent
        zip={zip}
        parentMetroSlug={parentMetro?.slug ?? null}
        parentMetroName={parentMetro?.shortName ?? null}
        parentCountySlug={parentCounty?.slug ?? null}
        parentCountyName={parentCounty?.shortName ?? null}
      />

      {stats && <MarketStatsBlock data={stats} geoName={zip.shortName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                zip.shortName,
                `https://propertyiq.up.railway.app/markets/zip/${zip.slug}`,
              ),
            ),
          }}
        />
      )}

      {/* Server-rendered SEO content */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {zip.shortName} Housing Market Overview
        </h2>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <p>{seoContent.opening}</p>
          <p>{seoContent.regional}</p>
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        {/* Nearby ZIPs for internal linking */}
        {nearbyZips.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-medium text-on-surface mb-3">
              Other {zip.state} ZIP Codes
            </h3>
            <div className="flex flex-wrap gap-2">
              {nearbyZips.map((z) => (
                <Link
                  key={z.zip}
                  href={`/markets/zip/${z.slug}`}
                  className="text-sm text-primary hover:text-primary/80 underline underline-offset-4"
                >
                  {z.shortName}
                </Link>
              ))}
            </div>
          </div>
        )}

        {parentCounty && (
          <p className="mt-6 text-sm text-on-surface-variant">
            {zip.shortName} is located in{" "}
            <Link
              href={`/markets/county/${parentCounty.slug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentCounty.shortName}
            </Link>
            .
          </p>
        )}

        {parentMetro && (
          <p className="mt-4 text-sm text-on-surface-variant">
            This ZIP code is part of the{" "}
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
          {stats?.latestDate
            ? `Market data through ${new Date(stats.latestDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
            : ""}{" "}
          Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED,
          BLS, and BEA. Per-statistic source and date shown above.
        </p>
      </section>
    </>
  );
}
