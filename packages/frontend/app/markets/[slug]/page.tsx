import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import { MetroPageContent } from "./MetroPageContent";

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

  return {
    title: `${metro.shortName} Housing Market 2026 | Prices, Scores & Forecast`,
    description: `${metro.shortName} housing market analysis with AI-powered HomeReady, InvestorEdge, and Market Health scores. Explore median home prices, rental demand, market trends, and investment forecasts for the ${metro.name} metro area.`,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${metro.shortName} Housing Market Analysis | PropertyIQ`,
      description: `AI-powered market intelligence for ${metro.shortName}. HomeReady & InvestorEdge scores, home prices, trends, and forecasts for the ${metro.name} area.`,
      siteName: "PropertyIQ",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `${metro.shortName} Housing Market Analysis - PropertyIQ`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${metro.shortName} Housing Market 2026 | PropertyIQ`,
      description: `AI scores, home prices, rental demand & forecasts for ${metro.shortName}. Free market intelligence.`,
      images: ["/twitter-image.png"],
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

  return <MetroPageContent metro={metro} />;
}
