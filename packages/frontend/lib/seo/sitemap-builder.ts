/**
 * XML sitemap builders.
 *
 * Why route handlers instead of Next.js's `app/sitemap.ts` convention:
 * `generateSitemaps()` produces URLs at `/sitemap/[id].xml` and does NOT
 * generate a sitemap index at `/sitemap.xml`. Search engines expect a single
 * `/sitemap.xml` entry point. We control everything explicitly here.
 *
 * `<lastmod>` honesty (H4): data-page URLs carry the geo's REAL latest score
 * period. Google disregards `<lastmod>` site-wide if it's a fake per-request
 * timestamp, so static/state pages omit it rather than ship a fabricated one,
 * and blog posts use their real frontmatter date. `<changefreq>`/`<priority>`
 * are not emitted at all (L1) — Google ignores them.
 */
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { COUNTY_SLUG_DATA } from "@/lib/data/county-slug-data";
import { ZIP_SLUG_DATA } from "@/lib/data/zip-slug-data";
import { STATE_SLUG_DATA } from "@/lib/data/state-slug-data";
import { getAllPosts } from "@/lib/blog";
import { COMPARISONS } from "@/lib/data/comparisons";
import { fetchScoredLocationData } from "@/lib/data";
import type { SitemapUrl } from "./sitemap-xml";

export const BASE_URL = "https://www.propertyiq.app";

// Split ZIP sitemap into chunks of 10K URLs each.
// Smaller sitemaps help Google distribute crawl budget across the ~39K ZIPs.
export const ZIPS_PER_SITEMAP = 10000;

// Filter to real 5-digit US ZIPs. The raw slug data can include
// non-ZIP rows (e.g. CT council-of-governments / planning-region codes
// stored as 7-digit strings) which we must not emit to search engines.
const VALID_ZIP_DATA = ZIP_SLUG_DATA.filter((entry) =>
  /^\d{5}$/.test(entry.zip),
);

/** ISO datetime for a YYYY-MM-DD score date, or undefined when absent/invalid. */
function isoOrUndefined(date: string | null): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Keep only slug entries that have a PropertyIQ score (scoreless pages render a
 * bare "—" and read as thin content), and surface the geo's real refresh date
 * for honest `<lastmod>`. FAIL OPEN: if the scored-id lookup is empty (backend
 * error / cold cache) keep the full list — a transient outage must never wipe
 * the sitemap. `idOf` must yield the score `location_id` format: padded ZIP,
 * FIPS, or CBSA.
 */
async function scoredEntries<T>(
  geo: "metro" | "county" | "zip",
  entries: T[],
  idOf: (entry: T) => string,
): Promise<{ lastmod: string | undefined; entries: T[] }> {
  const { date, ids } = await fetchScoredLocationData(geo);
  const lastmod = isoOrUndefined(date);
  if (!ids.length) return { lastmod, entries }; // fail open
  const scored = new Set(ids);
  return {
    lastmod,
    entries: entries.filter((entry) => scored.has(idOf(entry))),
  };
}

/** Scored, sitemap-eligible ZIP entries + refresh date. */
async function getScoredZipData(): Promise<{
  lastmod: string | undefined;
  entries: typeof VALID_ZIP_DATA;
}> {
  return scoredEntries("zip", VALID_ZIP_DATA, (zip) => zip.zip);
}

/** Number of ZIP sitemap chunks after scoreless ZIPs are dropped. */
export async function getZipSitemapCount(): Promise<number> {
  const { entries } = await getScoredZipData();
  return Math.ceil(entries.length / ZIPS_PER_SITEMAP);
}

export function buildMainUrls(): SitemapUrl[] {
  // Static routes: no honest single date, so <lastmod> is omitted (better than
  // a fabricated per-request timestamp — see file header).
  const staticRoutes: SitemapUrl[] = [
    { loc: BASE_URL },
    { loc: `${BASE_URL}/markets` },
    { loc: `${BASE_URL}/blog` },
    { loc: `${BASE_URL}/map` },
    { loc: `${BASE_URL}/scores` },
    { loc: `${BASE_URL}/scores/methodology` },
    { loc: `${BASE_URL}/market` },
    { loc: `${BASE_URL}/graphs` },
    { loc: `${BASE_URL}/pricing` },
    { loc: `${BASE_URL}/data` },
    { loc: `${BASE_URL}/about` },
    { loc: `${BASE_URL}/contact` },
    { loc: `${BASE_URL}/about/terms` },
  ];

  // Blog posts carry a real, verifiable publish date.
  const blogRoutes: SitemapUrl[] = getAllPosts().map((post) => ({
    loc: `${BASE_URL}/blog/${post.slug}`,
    lastmod: isoOrUndefined(post.frontmatter.date),
  }));

  const comparisonRoutes: SitemapUrl[] = COMPARISONS.map((c) => ({
    loc: `${BASE_URL}/compare/${c.slug}`,
  }));

  return [...staticRoutes, ...blogRoutes, ...comparisonRoutes];
}

export async function buildStatesUrls(): Promise<SitemapUrl[]> {
  // State pages are score-backed; reuse the monthly refresh date (uniform
  // across geo levels — one pipeline run) so the states tier carries the same
  // honest <lastmod> as metros/counties/zips instead of none.
  const { date } = await fetchScoredLocationData("metro");
  const lastmod = isoOrUndefined(date);
  return [
    { loc: `${BASE_URL}/markets/state`, lastmod },
    ...STATE_SLUG_DATA.map((s) => ({
      loc: `${BASE_URL}/markets/state/${s.slug}`,
      lastmod,
    })),
  ];
}

export async function buildMetrosUrls(): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await scoredEntries(
    "metro",
    METRO_SLUG_DATA,
    (metro) => metro.cbsaCode,
  );
  return entries.map((metro) => ({
    loc: `${BASE_URL}/markets/${metro.slug}`,
    lastmod,
  }));
}

export async function buildCountiesUrls(): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await scoredEntries(
    "county",
    COUNTY_SLUG_DATA,
    (county) => county.fips,
  );
  return entries.map((county) => ({
    loc: `${BASE_URL}/markets/county/${county.slug}`,
    lastmod,
  }));
}

export async function buildZipChunkUrls(
  chunkIndex: number,
): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await getScoredZipData();
  const start = chunkIndex * ZIPS_PER_SITEMAP;
  const end = start + ZIPS_PER_SITEMAP;
  return entries.slice(start, end).map((zip) => ({
    loc: `${BASE_URL}/markets/zip/${zip.slug}`,
    lastmod,
  }));
}

export async function buildIndexEntries(): Promise<
  { loc: string; lastmod?: string }[]
> {
  // Each sub-sitemap's <lastmod> reflects its own content's real refresh date.
  // (Same-endpoint fetches dedupe in the Next data cache.)
  const [metro, county, zip, zipChunks] = await Promise.all([
    fetchScoredLocationData("metro"),
    fetchScoredLocationData("county"),
    fetchScoredLocationData("zip"),
    getZipSitemapCount(),
  ]);

  const entries: { loc: string; lastmod?: string }[] = [
    { loc: `${BASE_URL}/sitemaps/main` },
    // States share the same monthly refresh date as the other geo tiers.
    { loc: `${BASE_URL}/sitemaps/states`, lastmod: isoOrUndefined(metro.date) },
    { loc: `${BASE_URL}/sitemaps/metros`, lastmod: isoOrUndefined(metro.date) },
    {
      loc: `${BASE_URL}/sitemaps/counties`,
      lastmod: isoOrUndefined(county.date),
    },
  ];

  const zipLastmod = isoOrUndefined(zip.date);
  for (let i = 0; i < zipChunks; i++) {
    entries.push({
      loc: `${BASE_URL}/sitemaps/zips-${i + 1}`,
      lastmod: zipLastmod,
    });
  }
  return entries;
}

export async function buildSitemapById(
  id: string,
): Promise<SitemapUrl[] | null> {
  if (id === "main") return buildMainUrls();
  if (id === "states") return buildStatesUrls();
  if (id === "metros") return buildMetrosUrls();
  if (id === "counties") return buildCountiesUrls();

  const zipMatch = /^zips-(\d+)$/.exec(id);
  if (zipMatch) {
    const chunkNumber = parseInt(zipMatch[1], 10);
    const chunkIndex = chunkNumber - 1;
    const zipChunks = await getZipSitemapCount();
    if (chunkIndex < 0 || chunkIndex >= zipChunks) return null;
    return buildZipChunkUrls(chunkIndex);
  }

  return null;
}
