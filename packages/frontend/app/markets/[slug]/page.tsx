import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { METRO_SLUG_DATA, SLUG_TO_METRO } from '@/lib/data/metro-slug-data';
import { MetroPageContent } from './MetroPageContent';

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

  return {
    title: `${metro.shortName} Housing Market 2026 | Prices, Scores & Forecast`,
    description: `${metro.shortName} housing market analysis. AI-powered scores, median home prices, trends, and forecasts for the ${metro.name} metro area.`,
    openGraph: {
      title: `${metro.shortName} Housing Market Analysis | PropertyIQ`,
      description: `Explore AI-powered market intelligence for ${metro.shortName}. Scores, metrics, and trend data.`,
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
