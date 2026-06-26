import type { Metadata } from "next";
import { formatMarketsScored } from "@/lib/data/validation-claims";

/**
 * Canonical homepage metadata — the single source of truth shared by BOTH the
 * control homepage (`app/(app)/page.tsx`, variant A) and the narrative rewrite
 * (`app/(app)/home-v2/page.tsx`, variant B). Because B is served at `/` via a
 * middleware rewrite, its metadata MUST be byte-identical to A so SEO carries
 * over unchanged (no title/canonical/OG divergence). B previews are kept out of
 * the index by middleware's `X-Robots-Tag: noindex` header, not by metadata, so
 * this object stays indexable with canonical `/` for both.
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
