import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import { resolveMetroAlias } from "@/lib/data/market-slug-aliases";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";
import {
  fetchSeoMarketStats,
  fetchRankings,
  fetchCachedInsight,
} from "@/lib/data";
import {
  buildMarketTitle,
  buildMarketDescription,
  buildMarketOgImagePath,
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
  getAncestorChainForMetro,
  getCountiesForMetro,
  getZipsForMetro,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MetroPageContent } from "./MetroPageContent";
import { generateMarketSeoContent } from "./generate-seo-content";

// Pre-render a bounded set at build; the long tail renders on-demand via ISR (dynamicParams default true) to avoid OOM from per-page server fetches.
export function generateStaticParams() {
  return METRO_SLUG_DATA.slice(0, 150).map((metro) => ({ slug: metro.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};

  const pageUrl = `https://www.propertyiq.app/markets/${metro.slug}`;

  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct, not
  // micro-boilerplate Google would rewrite.
  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);
  const title = buildMarketTitle(metro.shortName, stats);
  const description = buildMarketDescription(metro.shortName, stats);
  const ogImageUrl = buildMarketOgImagePath(metro.shortName, stats);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
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
          alt: `${metro.shortName} Housing Market Analysis - PropertyIQ`,
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

export default async function MetroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) {
    // A natural city-name slug ("charlotte-nc") isn't canonical, but it
    // unambiguously points at one metro page ("charlotte-concord-gastonia-nc-sc").
    // 308-redirect to canonical instead of 404, mirroring the bare-ZIP route.
    const canonical = resolveMetroAlias(slug);
    if (canonical) permanentRedirect(`/markets/${canonical}`);
    notFound();
  }

  const chain = getAncestorChainForMetro(metro);

  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);
  const seoContent = generateMarketSeoContent(metro, stats);
  const forecastYear = forecastDisplayYear(stats?.latestDate ?? null);

  // Same OG card the meta tags reference, embedded as a real, alt-bearing image
  // so non-JS AI crawlers (GPTBot/ClaudeBot/PerplexityBot) see an actual visual
  // of this market's data — not just a <meta> link. Absolute URL for the schema.
  const ogImagePath = buildMarketOgImagePath(metro.shortName, stats);
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${metro.shortName} housing market snapshot from PropertyIQ — median home price, year-over-year appreciation, median days on market, and PropertyIQ demand score.`;

  // Cache-only narrative for SSR: surfaces the pre-generated AI market overview
  // into the initial HTML when one exists, and NEVER triggers a paid generation
  // during ISR (cachedOnly=1). Null when uncached — the client island then
  // fetches live for real visitors.
  const serverInsight = await fetchCachedInsight(
    "metro",
    metro.cbsaCode,
    "market_overview",
  );

  // Related metros: same-state ranked by PropertyIQ score (server-rendered).
  const metroRank = await fetchRankings("propertyiq", "metro", {
    state: metro.state,
    limit: 8,
  });
  const metroBySlug = new Map(METRO_SLUG_DATA.map((m) => [m.cbsaCode, m]));
  const relatedMetros = metroRank
    .filter((r) => r.id !== metro.cbsaCode && metroBySlug.has(r.id))
    .map((r) => metroBySlug.get(r.id)!)
    .slice(0, 5);

  // Down-links: every county/ZIP in this metro, capped with a "view all" link
  // to the dedicated overflow page (only present when the parent exceeds the cap).
  const counties = getCountiesForMetro(metro.cbsaCode);
  const zips = getZipsForMetro(metro.cbsaCode);
  const linkGroups = [
    buildLinkGroup(
      `Counties in the ${metro.shortName} metro area`,
      counties.map((c) => ({
        key: c.fips,
        label: c.shortName,
        href: `/markets/county/${c.slug}`,
      })),
      MARKET_LINKS_DISPLAY_CAP,
      `/markets/${metro.slug}/counties`,
    ),
    buildLinkGroup(
      `ZIP codes in the ${metro.shortName} metro area`,
      zips.map((z) => ({
        key: z.zip,
        label: z.zip,
        href: `/markets/zip/${z.slug}`,
      })),
      MARKET_LINKS_DISPLAY_CAP,
      `/markets/${metro.slug}/zips`,
    ),
    {
      label: `Top markets in ${metro.state}`,
      links: relatedMetros.map((m) => ({
        key: m.cbsaCode,
        label: m.shortName,
        href: `/markets/${m.slug}`,
      })),
    },
  ];

  return (
    <>
      <MetroPageContent
        metro={metro}
        initialInsight={serverInsight}
        chain={chain}
      />

      {stats && <MarketStatsBlock data={stats} geoName={metro.shortName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                metro.shortName,
                `https://www.propertyiq.app/markets/${metro.slug}`,
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
              "@id": `https://www.propertyiq.app/markets/${metro.slug}#primaryimage`,
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

      {/* Server-rendered SEO content — visible to crawlers without JS */}
      <section className="w-full max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {metro.shortName} Housing Market Overview
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
              {metro.shortName} market snapshot
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
          {seoContent.stateContext && <p>{seoContent.stateContext}</p>}
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        <MarketRelatedLinks groups={linkGroups} />

        <p className="mt-8 text-xs text-on-surface-variant/60">
          {stats?.latestDate
            ? `Market data through ${new Date(stats.latestDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
            : ""}{" "}
          Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED,
          BLS, and BEA. Per-statistic source and date shown above.
        </p>
      </section>

      <section className="w-full max-w-4xl mx-auto px-4 py-6">
        <Link
          href={`/forecast/${metro.slug}`}
          className="block rounded-xl border border-outline-variant p-5 hover:bg-surface-container-low"
        >
          <span className="text-base font-medium text-on-surface">
            {metro.shortName} Housing Market Forecast {forecastYear} →
          </span>
          <span className="mt-1 block text-sm text-on-surface-variant">
            Where the momentum data says this market is heading — score,
            confidence grade, and the signals behind it.
          </span>
        </Link>
      </section>

      <MarketFaqSection
        faqs={buildMarketFaqs({
          displayName: metro.shortName,
          geoLabel: "metro area",
          stats,
        })}
      />
    </>
  );
}
