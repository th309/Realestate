import type { Metadata } from "next";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { MarketSearch } from "./MarketSearch";

export const metadata: Metadata = {
  title: "US Housing Markets | PropertyIQ",
  description: `Browse AI-powered housing market analysis for ${METRO_SLUG_DATA.length} US metro areas. PropertyIQ scores, median home prices, rental demand, trends, and investment forecasts for every major metro.`,
  alternates: {
    canonical: "https://www.propertyiq.app/markets",
  },
  openGraph: {
    type: "website",
    url: "https://www.propertyiq.app/markets",
    title: "US Housing Markets | PropertyIQ",
    description: `Explore ${METRO_SLUG_DATA.length} US metro housing markets with AI-powered scores, price trends, and investment analytics.`,
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
    title: "US Housing Markets | PropertyIQ",
    description: `AI market scores, prices & forecasts for ${METRO_SLUG_DATA.length} US metros. Free market intelligence.`,
    images: ["/twitter-image.png"],
  },
};

export default function MarketsIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-on-surface mb-2">
        US Housing Markets
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Browse AI-powered housing market analysis for {METRO_SLUG_DATA.length}{" "}
        US metro areas. Each market page includes PropertyIQ scores, key
        metrics, and price trends.
      </p>

      <MarketSearch metros={METRO_SLUG_DATA} />
    </div>
  );
}
