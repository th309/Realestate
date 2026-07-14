/**
 * Page-specific FAQ content for the /markets directory (index) page.
 *
 * This is the top-level directory: "Browse by State" links plus a metro
 * search box (see MarketSearch.tsx, which filters METRO_SLUG_DATA by name
 * and state only — it does not search counties or ZIP codes directly).
 * Distinct from the per-state hub FAQ (/markets/state/[state], Task 16) and
 * the per-market FAQ built by build-market-faqs.ts for metro/county/ZIP
 * pages — these questions are about navigating the directory itself and
 * PropertyIQ's overall geography/coverage model, not about any one market's
 * price trend or score.
 *
 * Every number below is sourced from COVERAGE_COPY (live scored coverage,
 * lib/data/validation-claims.ts) or METRO_SLUG_DATA.length (the directory's
 * own metro count, lib/data/metro-slug-data.ts) — never hardcoded.
 */
import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";

export const MARKETS_DIRECTORY_FAQS: Faq[] = [
  {
    question: "How do I find data for a specific housing market on PropertyIQ?",
    answer: `Search for any of PropertyIQ's ${METRO_SLUG_DATA.length} US metro areas by name using the search box on this page, or use the dropdown next to it to filter results down to a single state. Counties and ZIP codes are not searchable from this page directly, so to reach one, open its state or metro page first and drill down from there. Every market page you land on includes its current PropertyIQ Score, home value trends, days on market, and a FAQ section specific to that market.`,
  },
  {
    question: "What geography levels does PropertyIQ track?",
    answer: `PropertyIQ tracks four geography levels: state, metro area, county, and ZIP code, covering ${COVERAGE_COPY.sentence}. Each level rolls up into the next, so you can drill from a state down to an individual ZIP code's market data.`,
  },
  {
    question:
      "Does every metro area in this directory have a live PropertyIQ Score?",
    answer: `This directory lists all ${METRO_SLUG_DATA.length} US metro areas that PropertyIQ tracks, but a live PropertyIQ Score requires at least two of its four underlying inputs, Zillow home-value momentum and Realtor.com days-on-market and price-cut data, to be available for that market. Right now ${COVERAGE_COPY.metros} of those metro areas have a live score, alongside ${COVERAGE_COPY.counties} counties and ${COVERAGE_COPY.zips} ZIP codes. A metro that falls short of that data threshold still has its own market page with whatever metrics are available, just without a score section until coverage improves.`,
  },
  {
    question: "How often is PropertyIQ's market data updated?",
    answer: `PropertyIQ ingests new source data every month, pulling home values and rents from Zillow, days on market and price-cut activity from Realtor.com, additional housing signals from Redfin, and economic and demographic data from the Census Bureau, FRED, and the Bureau of Labor Statistics. Each market's PropertyIQ Score is recomputed monthly once that new data lands, so the score and its underlying inputs reflect the most recent complete reporting period rather than a static snapshot. Because official housing and economic data is typically released with a short lag, the current-through date on any given market page usually trails today by a few weeks, which is normal and not a sign of stale data.`,
  },
  {
    question:
      "What's the difference between browsing by metro, county, and ZIP code?",
    answer: `A metro area page covers an entire multi-county commuting region, giving the broadest view of a market's home values, rents, and demand trends. A county page narrows that view to a single county, and a ZIP code page narrows further still to a specific neighborhood or submarket, which is PropertyIQ's most granular level. All three levels share the same PropertyIQ Score formula and its four underlying inputs, so scores stay directly comparable as you zoom from a metro down to a single ZIP code.`,
  },
];
