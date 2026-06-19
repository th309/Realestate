import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { COUNTY_SLUG_DATA, SLUG_TO_COUNTY } from "@/lib/data/county-slug-data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import { isLocationIndexable } from "@/lib/seo/scored-locations";
import {
  buildMarketTitle,
  buildMarketDescription,
} from "@/lib/seo/market-metadata";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { CountyPageContent } from "./CountyPageContent";
import { generateCountySeoContent } from "./generate-seo-content";

// Pre-render a bounded set at build; the long tail renders on-demand via ISR (dynamicParams default true) to avoid OOM from per-page server fetches.
export function generateStaticParams() {
  return COUNTY_SLUG_DATA.slice(0, 150).map((county) => ({
    slug: county.slug,
  }));
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

  // Scoreless counties render a bare "—" and read as thin content — keep them
  // out of the index (still crawlable via follow so internal links pass equity).
  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct.
  const [indexable, stats] = await Promise.all([
    isLocationIndexable("county", county.fips),
    fetchSeoMarketStats("county", county.fips, county.state),
  ]);
  const title = buildMarketTitle(county.shortName, stats);
  const description = buildMarketDescription(county.shortName, stats);

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} | PropertyIQ`,
      description,
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
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

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

  // Neighboring counties in the same state, ranked by PropertyIQ score.
  const countyRank = await fetchRankings("propertyiq", "county", {
    state: county.state,
    limit: 12,
  });
  const countyByFips = new Map(COUNTY_SLUG_DATA.map((c) => [c.fips, c]));
  const rankedCounties = countyRank
    .filter((r) => r.id !== county.fips && countyByFips.has(r.id))
    .map((r) => countyByFips.get(r.id)!)
    .slice(0, 6);
  const nearbyCounties = rankedCounties.length
    ? rankedCounties
    : COUNTY_SLUG_DATA.filter(
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

  const stats = await fetchSeoMarketStats("county", county.fips, county.state);
  const seoContent = generateCountySeoContent(county, stats);

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

      {stats && <MarketStatsBlock data={stats} geoName={county.shortName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                county.shortName,
                `https://www.propertyiq.app/markets/county/${county.slug}`,
              ),
            ),
          }}
        />
      )}

      {/* Server-rendered SEO content */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {county.shortName} Housing Market Overview
        </h2>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          {seoContent.dataSummary && (
            <p className="text-on-surface font-medium">
              {seoContent.dataSummary}
            </p>
          )}
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
