import type { Metadata } from "next";
import Link from "next/link";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { STATE_SLUG_DATA } from "@/lib/data/state-slug-data";
import { MarketSearch } from "./MarketSearch";

export const metadata: Metadata = {
  title: "Housing Market Analysis by City — PropertyIQ",
  description: `Browse housing market analysis for ${METRO_SLUG_DATA.length} US metro areas — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`,
  alternates: {
    canonical: "https://www.propertyiq.app/markets",
  },
  openGraph: {
    type: "website",
    url: "https://www.propertyiq.app/markets",
    title: "Housing Market Analysis by City — PropertyIQ",
    description: `Browse housing market analysis for ${METRO_SLUG_DATA.length} US metro areas — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`,
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "US Housing Markets - PropertyIQ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Housing Market Analysis by City — PropertyIQ",
    description: `Browse housing market analysis for ${METRO_SLUG_DATA.length} US metro areas — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`,
    images: ["/twitter-image.png"],
  },
};

export default function MarketsIndexPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-on-surface mb-2">
        Housing Market Analysis by City
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Browse AI-powered housing market analysis for {METRO_SLUG_DATA.length}{" "}
        US metro areas. Each market page includes PropertyIQ scores, key
        metrics, and price trends.
      </p>

      {/* Browse by State — static server-rendered links for SEO crawlability */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          Browse by State
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {STATE_SLUG_DATA.map((s) => (
            <Link
              key={s.abbrev}
              href={`/markets/state/${s.slug}`}
              className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 py-1"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      <MarketSearch metros={METRO_SLUG_DATA} />
    </div>
  );
}
