import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { COUNTY_SLUG_DATA, SLUG_TO_COUNTY } from "@/lib/data/county-slug-data";
import { resolveCountyAlias } from "@/lib/data/market-slug-aliases";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import {
  buildMarketTitle,
  buildMarketDescription,
  buildMarketOgImagePath,
  isMarketPageIndexable,
} from "@/lib/seo/market-metadata";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildMarketFaqs } from "@/app/markets/components/build-market-faqs";
import {
  MarketRelatedLinks,
  buildLinkGroup,
} from "@/app/markets/components/MarketRelatedLinks";
import {
  getAncestorChainForCounty,
  getZipsForCounty,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
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

  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct.
  const stats = await fetchSeoMarketStats("county", county.fips, county.state);
  const title = buildMarketTitle(county.shortName, stats);
  const description = buildMarketDescription(county.shortName, stats);
  const ogImageUrl = buildMarketOgImagePath(county.shortName, stats);

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: { index: isMarketPageIndexable(stats), follow: true },
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
  if (!county) {
    // A natural county slug without the "-county" segment ("mecklenburg-nc")
    // isn't canonical, but unambiguously points at one county page. 308-redirect
    // to canonical ("mecklenburg-county-nc") instead of 404.
    const canonical = resolveCountyAlias(slug);
    if (canonical) permanentRedirect(`/markets/county/${canonical}`);
    notFound();
  }

  // Find parent metro for cross-linking
  const parentMetro = county.cbsaCode
    ? CBSA_TO_METRO.get(county.cbsaCode)
    : null;

  const chain = getAncestorChainForCounty(county);

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

  const stats = await fetchSeoMarketStats("county", county.fips, county.state);
  const seoContent = generateCountySeoContent(county, stats);

  // Same OG card the meta tags reference, embedded as a real, alt-bearing image
  // so non-JS AI crawlers (GPTBot/ClaudeBot/PerplexityBot) see an actual visual
  // of this county's data — not just a <meta> link. Absolute URL for the schema.
  const ogImagePath = buildMarketOgImagePath(county.shortName, stats);
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${county.shortName} housing market snapshot from PropertyIQ — median home price, year-over-year appreciation, median days on market, and PropertyIQ demand score.`;

  // Down-link: every ZIP in this county, capped with a "view all" link.
  const zips = getZipsForCounty(county.fips);
  const linkGroups = [
    buildLinkGroup(
      `ZIP codes in ${county.shortName}`,
      zips.map((z) => ({
        key: z.zip,
        label: z.zip,
        href: `/markets/zip/${z.slug}`,
      })),
      MARKET_LINKS_DISPLAY_CAP,
      `/markets/county/${county.slug}/zips`,
    ),
    {
      label: `Other ${county.state} Counties`,
      links: nearbyCounties.map((c) => ({
        key: c.fips,
        label: c.shortName,
        href: `/markets/county/${c.slug}`,
      })),
    },
  ];

  return (
    <>
      <CountyPageContent
        county={county}
        parentMetroSlug={parentMetro?.slug ?? null}
        parentMetroName={parentMetro?.shortName ?? null}
        chain={chain}
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
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ImageObject",
              "@id": `https://www.propertyiq.app/markets/county/${county.slug}#primaryimage`,
              url: ogImageUrl,
              contentUrl: ogImageUrl,
              width: 1200,
              height: 630,
              encodingFormat: "image/png",
              caption: ogImageAlt,
              representativeOfPage: true,
              creditText: "PropertyIQ",
              creator: { "@type": "Organization", name: "PropertyIQ" },
            }),
          }}
        />
      )}

      {/* Server-rendered SEO content */}
      <section className="w-full max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {county.shortName} Housing Market Overview
        </h2>

        {stats && (
          <figure className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic edge-generated OG card; not worth routing through the next/image optimizer */}
            <img
              src={ogImagePath}
              alt={ogImageAlt}
              width={1200}
              height={630}
              loading="lazy"
              className="w-full max-w-2xl mx-auto rounded-xl border border-outline-variant shadow-sm"
            />
            <figcaption className="mt-2 text-center text-xs text-on-surface-variant/70">
              {county.shortName} market snapshot
              {stats.latestDate
                ? ` — data through ${new Date(
                    stats.latestDate,
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}`
                : ""}
            </figcaption>
          </figure>
        )}

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

        <MarketRelatedLinks groups={linkGroups} />

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

      <MarketFaqSection
        faqs={buildMarketFaqs({
          displayName: county.shortName,
          geoLabel: "county",
          stats,
        })}
      />
    </>
  );
}
