import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  ZIP_SLUG_DATA,
  SLUG_TO_ZIP,
  ZIP_TO_ENTRY,
} from "@/lib/data/zip-slug-data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { FIPS_TO_COUNTY } from "@/lib/data/county-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import {
  buildMarketTitle,
  buildMarketDescription,
  buildMarketOgImagePath,
} from "@/lib/seo/market-metadata";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildMarketFaqs } from "@/app/markets/components/build-market-faqs";
import { MarketRelatedLinks } from "@/app/markets/components/MarketRelatedLinks";
import { getAncestorChainForZip } from "@/lib/data/market-hierarchy";
import { ZipPageContent } from "./ZipPageContent";
import { generateZipSeoContent } from "./generate-seo-content";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";

/**
 * A legacy/malformed entry has no real city: its `shortName` is "<zip>, <zip>, "
 * (city echoed the ZIP, empty state) and `slug` is "<zip>-<zip>". Such rows
 * should no longer be generated, but guard at render so a directly-hit stale
 * slug never produces a "<zip> <zip>" title.
 */
function isMissingCity(zip: ZipSlugEntry): boolean {
  return zip.state.trim() === "" || zip.slug === `${zip.zip}-${zip.zip}`;
}

/** Clean display label: "Springfield, MA 01093" style, or "ZIP <zip>" fallback. */
function zipDisplayName(zip: ZipSlugEntry): string {
  return isMissingCity(zip) ? `ZIP ${zip.zip}` : zip.shortName;
}

// Pre-render a bounded set at build; the long tail renders on-demand via ISR (dynamicParams default true) to avoid OOM from per-page server fetches.
// Exclude any malformed (city-less) entry so we never statically build a broken page.
export function generateStaticParams() {
  return ZIP_SLUG_DATA.filter((zip) => !isMissingCity(zip))
    .slice(0, 50)
    .map((zip) => ({ slug: zip.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const zip = SLUG_TO_ZIP.get(slug);
  if (!zip) return {};

  // Resilience: a malformed entry (no city — e.g. a stale "01093-01093" slug
  // where shortName is "01093, 01093, ") must never yield a "01093 01093"
  // title. Derive a clean place name, falling back to "ZIP <zip>".
  const cityState = isMissingCity(zip)
    ? ""
    : zip.shortName.replace(`${zip.zip}, `, "").trim();
  const place = cityState ? `${zip.zip} ${cityState}` : `ZIP ${zip.zip}`;
  const ogTitle = cityState ? zip.shortName : `ZIP ${zip.zip}`;
  const pageUrl = `https://www.propertyiq.app/markets/zip/${zip.slug}`;

  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct.
  const name = place;
  const stats = await fetchSeoMarketStats("zip", zip.zip, zip.state);
  const title = buildMarketTitle(name, stats);
  const description = buildMarketDescription(name, stats);
  const ogImageUrl = buildMarketOgImagePath(ogTitle, stats);

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
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
          alt: `${ogTitle} Housing Market Analysis`,
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

export default async function ZipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const zip = SLUG_TO_ZIP.get(slug);
  if (!zip) {
    // A bare 5-digit ZIP (e.g. "28202") is the most natural URL a person types,
    // but the canonical page lives at the city-state slug ("28202-charlotte-nc").
    // The ZIP alone is unambiguous, so 308-redirect to canonical instead of 404.
    if (/^\d{5}$/.test(slug)) {
      const canonical = ZIP_TO_ENTRY.get(slug);
      if (canonical && !isMissingCity(canonical) && canonical.slug !== slug) {
        permanentRedirect(`/markets/zip/${canonical.slug}`);
      }
    }
    notFound();
  }

  // Clean, city-aware label (never "<zip>, <zip>, ") for all visible copy.
  const displayName = zipDisplayName(zip);

  // Find parent metro for cross-linking
  const parentMetro = zip.cbsaCode ? CBSA_TO_METRO.get(zip.cbsaCode) : null;

  // Find parent county for cross-linking
  const parentCounty = zip.countyFips
    ? FIPS_TO_COUNTY.get(zip.countyFips)
    : null;

  const chain = getAncestorChainForZip(zip);

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

  const stats = await fetchSeoMarketStats("zip", zip.zip, zip.state);
  const seoContent = generateZipSeoContent(zip, stats);

  // Same OG card the meta tags reference, embedded as a real, alt-bearing image
  // so non-JS AI crawlers (GPTBot/ClaudeBot/PerplexityBot) see an actual visual
  // of this ZIP's data — not just a <meta> link. Absolute URL for the schema.
  const ogImagePath = buildMarketOgImagePath(displayName, stats);
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${displayName} housing market snapshot from PropertyIQ — median home price, year-over-year appreciation, median days on market, and PropertyIQ demand score.`;

  const linkGroups = [
    {
      label: `Other ${zip.state} ZIP Codes`,
      links: nearbyZips.map((z) => ({
        key: z.zip,
        label: z.shortName,
        href: `/markets/zip/${z.slug}`,
      })),
    },
  ];

  return (
    <>
      <ZipPageContent
        zip={zip}
        parentMetroSlug={parentMetro?.slug ?? null}
        parentMetroName={parentMetro?.shortName ?? null}
        parentCountySlug={parentCounty?.slug ?? null}
        parentCountyName={parentCounty?.shortName ?? null}
        chain={chain}
      />

      {stats && <MarketStatsBlock data={stats} geoName={displayName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                displayName,
                `https://www.propertyiq.app/markets/zip/${zip.slug}`,
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
              "@id": `https://www.propertyiq.app/markets/zip/${zip.slug}#primaryimage`,
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
          {displayName} Housing Market Overview
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
              {displayName} market snapshot
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

        {parentCounty && (
          <p className="mt-6 text-sm text-on-surface-variant">
            {displayName} is located in{" "}
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

      <MarketFaqSection
        faqs={buildMarketFaqs({
          displayName,
          geoLabel: "ZIP code",
          stats,
        })}
      />
    </>
  );
}
