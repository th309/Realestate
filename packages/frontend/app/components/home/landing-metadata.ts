import type { Metadata } from "next";
import { formatMarketsScored } from "@/lib/data/validation-claims";

/**
 * Canonical homepage metadata for `app/(app)/page.tsx`.
 *
 * It lives in its own module because it was the shared, byte-identical metadata
 * of the retired landing A/B split — keeping it here means the title, canonical
 * and OG fields that survived that experiment are still edited in exactly one
 * place, and `/` stays indexable with canonical `https://www.propertyiq.app`.
 */
export const landingMetadata: Metadata = {
  title: {
    absolute:
      "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
  },
  // markets total derives from formatMarketsScored() — single source of truth
  description: `Analyze ${formatMarketsScored()} real estate markets with AI-powered scores, rent data, and investment insights. Free market maps, reports & forecasts by metro, county, and ZIP code.`,
  alternates: { canonical: "https://www.propertyiq.app" },
  openGraph: {
    title:
      "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
    type: "website",
    // markets total derives from formatMarketsScored() — single source of truth
    description: `Analyze ${formatMarketsScored()} real estate markets with AI-powered scores, rent data, and investment insights. Free maps, reports & forecasts by metro, county, and ZIP code.`,
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ real estate market analysis dashboard",
      },
    ],
  },
};
