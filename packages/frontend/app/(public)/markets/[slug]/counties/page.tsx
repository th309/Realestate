import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import {
  getCountiesForMetro,
  getAncestorChainForMetro,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";

// Only generate this overflow page for metros with more counties than the
// inline display cap — a metro at or under the cap already shows every county
// on its own page, so a duplicate "view all" page would be redundant content.
export function generateStaticParams() {
  return METRO_SLUG_DATA.filter(
    (metro) =>
      getCountiesForMetro(metro.cbsaCode).length > MARKET_LINKS_DISPLAY_CAP,
  ).map((metro) => ({ slug: metro.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};
  const counties = getCountiesForMetro(metro.cbsaCode);
  if (counties.length <= MARKET_LINKS_DISPLAY_CAP) return {};

  const pageUrl = `https://www.propertyiq.app/markets/${metro.slug}/counties`;
  const title = `All ${counties.length} Counties in the ${metro.shortName} Metro Area`;
  const description = `Browse PropertyIQ market data for every county in the ${metro.shortName} metro area — ${counties.length} counties tracked.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function MetroCountiesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) notFound();

  const counties = getCountiesForMetro(metro.cbsaCode);
  if (counties.length <= MARKET_LINKS_DISPLAY_CAP) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={{ ...getAncestorChainForMetro(metro), metro }}
        currentName="Counties"
        currentHref={`/markets/${metro.slug}/counties`}
      />

      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        All Counties in the {metro.shortName} Metro Area
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        {counties.length} counties tracked by PropertyIQ in the{" "}
        {metro.shortName} metro area.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {counties.map((county) => (
          <Link
            key={county.fips}
            href={`/markets/county/${county.slug}`}
            className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-sm font-medium text-on-surface">
              {county.shortName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
