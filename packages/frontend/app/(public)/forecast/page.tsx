import type { Metadata } from "next";
import Link from "next/link";
import { fetchScoreDistribution, fetchRankings } from "@/lib/data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import type { MarketFaq } from "@/app/markets/components/build-market-faqs";
import { MarketMomentumMap } from "@/app/components/widgets/market-momentum-map";
import { DistributionSummary } from "./components/DistributionSummary";
import { distributionPhrase } from "./components/distribution-phrase";
import { ForecastMarketIndex } from "./components/ForecastMarketIndex";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const distribution = await fetchScoreDistribution("metro");
  const year = forecastDisplayYear(distribution?.date ?? null);
  const title = `Will Home Prices Crash in ${year}? What the Data Shows`;
  const description = `A data-first ${year} housing market forecast: live demand-momentum readings across every scored US metro — score, confidence grade, days on market, and price cuts. Updated monthly. No speculation.`;
  const pageUrl = "https://www.propertyiq.app/forecast";
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
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ForecastHubPage() {
  const [distribution, top, bottom] = await Promise.all([
    fetchScoreDistribution("metro"),
    fetchRankings("propertyiq", "metro", { limit: 5 }),
    fetchRankings("propertyiq", "metro", { limit: 5, order: "asc" }),
  ]);
  const year = forecastDisplayYear(distribution?.date ?? null);

  const toForecastLink = (r: { id: string; name: string; score: number }) => {
    const metro = CBSA_TO_METRO.get(r.id);
    return metro
      ? { ...r, slug: metro.slug, shortName: metro.shortName }
      : null;
  };
  const topLinks = top.map(toForecastLink).filter(Boolean) as Array<{
    slug: string;
    shortName: string;
    score: number;
  }>;
  const bottomLinks = bottom.map(toForecastLink).filter(Boolean) as Array<{
    slug: string;
    shortName: string;
    score: number;
  }>;

  const phrase = distribution
    ? distributionPhrase(distribution.buckets, distribution.total)
    : "a market moving unevenly, not in one direction";

  const faqs: MarketFaq[] = [
    {
      question: `Will home prices crash in ${year}?`,
      answer: `No single national answer is honest — housing is local. The live data shows ${phrase}: some metros have weak demand momentum while others are still firming. PropertyIQ tracks the demand signals that historically move before prices (price momentum, days on market, price cuts) across every scored metro, each with a confidence grade. Check your market's forecast page for its specific momentum reading.`,
    },
    {
      question: "How does PropertyIQ build these forecasts?",
      answer: `Each market gets a PropertyIQ Score from four measured inputs: 12-month price momentum, 3-month price momentum, median days on market, and the share of listings with price cuts. Scores are calibrated so 50 equals the market's state average, refreshed monthly, and each carries an A-F confidence grade for data quality. PropertyIQ never publishes specific price predictions.`,
    },
  ];

  // Only include the "cooling fastest" FAQ when there are actual bottom-ranked
  // metros to name — an empty rankings fetch would otherwise interpolate to
  // "...are ." (empty join).
  if (bottomLinks.length > 0) {
    faqs.push({
      question: "Which housing markets are cooling fastest?",
      answer: `The lowest-scoring metros right now are ${bottomLinks.map((m) => m.shortName).join(", ")}. A low score means weak demand momentum — days on market stretching and price cuts spreading — not a verdict that a market is bad.`,
    });
  }

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
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-2">
        <h1 className="text-3xl font-medium text-on-surface">
          Will Home Prices Crash in {year}? What the Data Shows
        </h1>
        <p className="mt-3 text-on-surface-variant leading-relaxed">
          Live demand-momentum readings across every scored US metro — updated
          monthly from price trends, days on market, and price-cut data, each
          with a confidence grade. No hot takes, no price targets.
        </p>
      </section>

      {distribution && (
        <DistributionSummary distribution={distribution} year={year} />
      )}

      <section className="max-w-4xl mx-auto px-4 pt-6">
        <MarketMomentumMap size="hero" />
      </section>

      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-xl font-medium text-on-surface mb-4">
              Strongest Momentum
            </h2>
            <div className="space-y-2">
              {topLinks.map((m) => (
                <Link
                  key={m.slug}
                  href={`/forecast/${m.slug}`}
                  className="flex justify-between rounded-xl border border-outline-variant p-4 hover:bg-surface-container-low"
                >
                  <span className="text-on-surface">{m.shortName}</span>
                  <span className="font-mono text-on-surface">{m.score}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-medium text-on-surface mb-4">
              Weakest Momentum
            </h2>
            <div className="space-y-2">
              {bottomLinks.map((m) => (
                <Link
                  key={m.slug}
                  href={`/forecast/${m.slug}`}
                  className="flex justify-between rounded-xl border border-outline-variant p-4 hover:bg-surface-container-low"
                >
                  <span className="text-on-surface">{m.shortName}</span>
                  <span className="font-mono text-on-surface">{m.score}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarketFaqSection faqs={faqs} />

      <ForecastMarketIndex year={year} />
    </>
  );
}
