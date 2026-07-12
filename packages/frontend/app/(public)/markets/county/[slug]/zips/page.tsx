import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { COUNTY_SLUG_DATA, SLUG_TO_COUNTY } from "@/lib/data/county-slug-data";
import {
  getZipsForCounty,
  getAncestorChainForCounty,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";

// Only generate this overflow page for counties with more ZIPs than the inline
// display cap — see the metro /counties and /zips routes for the same reasoning.
export function generateStaticParams() {
  return COUNTY_SLUG_DATA.filter(
    (county) => getZipsForCounty(county.fips).length > MARKET_LINKS_DISPLAY_CAP,
  ).map((county) => ({ slug: county.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) return {};
  const zips = getZipsForCounty(county.fips);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) return {};

  const pageUrl = `https://www.propertyiq.app/markets/county/${county.slug}/zips`;
  const title = `All ${zips.length} ZIP Codes in ${county.shortName}`;
  const description = `Browse PropertyIQ market data for every ZIP code in ${county.shortName} — ${zips.length} ZIP codes tracked.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function CountyZipsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) notFound();

  const zips = getZipsForCounty(county.fips);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) notFound();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={{ ...getAncestorChainForCounty(county), county }}
        currentName="ZIP Codes"
        currentHref={`/markets/county/${county.slug}/zips`}
      />

      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        All ZIP Codes in {county.shortName}
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        {zips.length} ZIP codes tracked by PropertyIQ in {county.shortName}.
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
