import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import {
  getZipsForMetro,
  getAncestorChainForMetro,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";

// Only generate this overflow page for metros with more ZIPs than the inline
// display cap — see the sibling /counties route for the same reasoning.
export function generateStaticParams() {
  return METRO_SLUG_DATA.filter(
    (metro) =>
      getZipsForMetro(metro.cbsaCode).length > MARKET_LINKS_DISPLAY_CAP,
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
  const zips = getZipsForMetro(metro.cbsaCode);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) return {};

  const pageUrl = `https://www.propertyiq.app/markets/${metro.slug}/zips`;
  const title = `All ${zips.length} ZIP Codes in the ${metro.shortName} Metro Area`;
  const description = `Browse PropertyIQ market data for every ZIP code in the ${metro.shortName} metro area — ${zips.length} ZIP codes tracked.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function MetroZipsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) notFound();

  const zips = getZipsForMetro(metro.cbsaCode);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) notFound();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={{ ...getAncestorChainForMetro(metro), metro }}
        currentName="ZIP Codes"
        currentHref={`/markets/${metro.slug}/zips`}
      />

      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        All ZIP Codes in the {metro.shortName} Metro Area
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        {zips.length} ZIP codes tracked by PropertyIQ in the {metro.shortName}{" "}
        metro area.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {zips.map((zip) => (
          <Link
            key={zip.zip}
            href={`/markets/zip/${zip.slug}`}
            className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors text-center"
          >
            <span className="text-sm font-medium text-on-surface">
              {zip.zip}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
