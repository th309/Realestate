import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { MetroPageContent } from "./MetroPageContent";
import { generateMarketSeoContent } from "./generate-seo-content";

export function generateStaticParams() {
  return METRO_SLUG_DATA.map((metro) => ({ slug: metro.slug }));
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
  const ogImageUrl = `/api/og?title=${encodeURIComponent(metro.shortName)}`;

  return {
    title: `${metro.shortName} Housing Market — 2026 Analysis`,
    description: `See the latest ${metro.shortName} housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${metro.shortName} Housing Market — 2026 Analysis`,
      description: `See the latest ${metro.shortName} housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`,
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
      title: `${metro.shortName} Housing Market — 2026 Analysis`,
      description: `See the latest ${metro.shortName} housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours

export default async function MetroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) notFound();

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
        name: metro.shortName,
        item: `https://www.propertyiq.app/markets/${metro.slug}`,
      },
    ],
  };

  const seoContent = generateMarketSeoContent(metro);

  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <MetroPageContent metro={metro} />

      {stats && <MarketStatsBlock data={stats} geoName={metro.shortName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                metro.shortName,
                `https://propertyiq.up.railway.app/markets/${metro.slug}`,
              ),
            ),
          }}
        />
      )}

      {/* Server-rendered SEO content — visible to crawlers without JS */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {metro.shortName} Housing Market Overview
        </h2>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <p>{seoContent.opening}</p>
          <p>{seoContent.regional}</p>
          {seoContent.stateContext && <p>{seoContent.stateContext}</p>}
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        {relatedMetros.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-medium text-on-surface mb-3">
              Top markets in {metro.state}
            </h3>
            <div className="flex flex-wrap gap-2">
              {relatedMetros.map((m) => (
                <Link
                  key={m.cbsaCode}
                  href={`/markets/${m.slug}`}
                  className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm hover:bg-surface-container-high transition-colors"
                >
                  {m.shortName}
                </Link>
              ))}
            </div>
          </div>
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
