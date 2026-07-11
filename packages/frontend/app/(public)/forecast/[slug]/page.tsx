import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import { resolveMetroAlias } from "@/lib/data/market-slug-aliases";
import {
  fetchSeoMarketStats,
  fetchRankings,
  fetchCachedInsight,
  fetchScore,
} from "@/lib/data";
import {
  buildForecastTitle,
  buildForecastDescription,
} from "@/lib/seo/forecast-metadata";
import { buildMarketOgImagePath } from "@/lib/seo/market-metadata";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildForecastFaqs } from "../components/build-forecast-faqs";
import { ForecastNarrativeSection } from "../components/ForecastNarrativeSection";
import { MomentumSignalsSection } from "../components/MomentumSignalsSection";
import { ForecastCrossLinks } from "../components/ForecastCrossLinks";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";

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

  const pageUrl = `https://www.propertyiq.app/forecast/${metro.slug}`;
  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);
  const title = buildForecastTitle(metro.shortName, stats);
  const description = buildForecastDescription(metro.shortName, stats);
  const ogImageUrl = buildMarketOgImagePath(metro.shortName, stats);

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
          alt: `${metro.shortName} housing market forecast - PropertyIQ`,
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

export const revalidate = 86400;
export const dynamicParams = true;

export default async function ForecastMetroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) {
    const canonical = resolveMetroAlias(slug);
    if (canonical) permanentRedirect(`/forecast/${canonical}`);
    notFound();
  }

  const [stats, serverInsight, scoreData, metroRank] = await Promise.all([
    fetchSeoMarketStats("metro", metro.cbsaCode, metro.state),
    fetchCachedInsight("metro", metro.cbsaCode, "market_forecast"),
    fetchScore("metro", metro.cbsaCode),
    fetchRankings("propertyiq", "metro", { state: metro.state, limit: 8 }),
  ]);

  const year = forecastDisplayYear(
    stats?.latestDate ?? scoreData?.score_date ?? null,
  );

  // Server-data-driven hero score: prefer the SEO stats assembler (reads the
  // score's own stored fields), fall back to the raw score fetch. Both are
  // already fetched above — no client-side fetch needed for the hero.
  const heroScore =
    stats?.score ?? scoreData?.scores?.propertyiq?.score ?? null;

  const metroBySlug = new Map(METRO_SLUG_DATA.map((m) => [m.cbsaCode, m]));
  const relatedMetros = metroRank
    .filter((r) => r.id !== metro.cbsaCode && metroBySlug.has(r.id))
    .map((r) => metroBySlug.get(r.id)!)
    .slice(0, 5);

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
        name: "Forecast",
        item: "https://www.propertyiq.app/forecast",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: metro.shortName,
        item: `https://www.propertyiq.app/forecast/${metro.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-3xl font-medium text-on-surface">
          {metro.shortName} Housing Market Forecast {year}
        </h1>
        <p className="mt-3 text-on-surface-variant leading-relaxed">
          A momentum-based outlook built from real market data: the PropertyIQ
          demand score, days on market, and price-cut trends — refreshed
          monthly, with a confidence grade. No speculation, no price targets.
        </p>
        {heroScore !== null && (
          <div className="mt-6 flex justify-center">
            <div className="flex flex-col items-center gap-2">
              <ScoreWidget
                geographyType="metro"
                geographyId={metro.cbsaCode}
                scoreType="propertyiq"
                size={120}
                showConfidence
              />
              <span className="text-sm font-medium text-on-surface">
                PropertyIQ Score
              </span>
              <p className="text-xs text-on-surface-variant">
                50 = state average · higher = stronger momentum
              </p>
            </div>
          </div>
        )}
      </section>

      <ForecastNarrativeSection
        metroName={metro.shortName}
        cbsaCode={metro.cbsaCode}
        initialInsight={serverInsight}
      />

      {scoreData?.z_scores && (
        <MomentumSignalsSection
          metroName={metro.shortName}
          zScores={scoreData.z_scores}
        />
      )}

      <MarketFaqSection
        faqs={buildForecastFaqs({ displayName: metro.shortName, stats })}
      />

      <ForecastCrossLinks
        metro={metro}
        relatedMetros={relatedMetros}
        year={year}
      />
    </>
  );
}
