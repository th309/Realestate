import type { Metadata } from "next";
import Link from "next/link";
import { STATE_SLUG_DATA } from "@/lib/data/state-slug-data";

export const metadata: Metadata = {
  title: "Real Estate Market Analysis by State — PropertyIQ",
  description:
    "Browse PropertyIQ's housing market analysis for all 50 US states — find the best cities to invest in any state with AI-powered scores, home prices, and rental yield data.",
  alternates: {
    canonical: "https://www.propertyiq.app/markets/state",
  },
  openGraph: {
    type: "website",
    url: "https://www.propertyiq.app/markets/state",
    title: "Real Estate Market Analysis by State — PropertyIQ",
    description:
      "Browse PropertyIQ's housing market analysis for all 50 US states — find the best cities to invest in any state with AI-powered scores, home prices, and rental yield data.",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "US Real Estate Markets by State - PropertyIQ",
      },
    ],
  },
};

export default function MarketsStateIndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-on-surface-variant mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/markets" className="hover:text-primary">Markets</Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface font-medium">Browse by State</span>
      </nav>

      <h1 className="text-3xl font-bold text-on-surface mb-3">
        Real Estate Market Analysis by State
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Explore PropertyIQ's AI-powered housing market scores for every US
        state. Each state page covers all metro areas and counties with
        PropertyIQ scores, home prices, and investment analysis.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {STATE_SLUG_DATA.map((s) => (
          <Link
            key={s.abbrev}
            href={`/markets/state/${s.slug}`}
            className="block p-4 rounded-xl border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
              {s.abbrev}
            </span>
            <p className="text-sm font-medium text-on-surface mt-0.5">
              {s.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
