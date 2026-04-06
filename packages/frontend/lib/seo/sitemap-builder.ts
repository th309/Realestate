/**
 * XML sitemap builders.
 *
 * Why route handlers instead of Next.js's `app/sitemap.ts` convention:
 * `generateSitemaps()` produces URLs at `/sitemap/[id].xml` and does NOT
 * generate a sitemap index at `/sitemap.xml`. Search engines expect a single
 * `/sitemap.xml` entry point. We control everything explicitly here.
 */
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { COUNTY_SLUG_DATA } from "@/lib/data/county-slug-data";
import { ZIP_SLUG_DATA } from "@/lib/data/zip-slug-data";
import { STATE_SLUG_DATA } from "@/lib/data/state-slug-data";
import { getAllPosts } from "@/lib/blog";
import { COMPARISONS } from "@/lib/data/comparisons";

export const BASE_URL = "https://www.propertyiq.app";

// Split ZIP sitemap into chunks of 10K URLs each.
// Smaller sitemaps help Google distribute crawl budget across the ~39K ZIPs.
export const ZIPS_PER_SITEMAP = 10000;
export const ZIP_SITEMAP_COUNT = Math.ceil(
  ZIP_SLUG_DATA.length / ZIPS_PER_SITEMAP,
);

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const SITEMAPINDEX_OPEN =
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderUrlset(urls: SitemapUrl[]): string {
  const items = urls
    .map((u) => {
      const parts = [`  <url>`, `    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq)
        parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority !== undefined)
        parts.push(`    <priority>${u.priority}</priority>`);
      parts.push(`  </url>`);
      return parts.join("\n");
    })
    .join("\n");
  return `${XML_HEADER}\n${URLSET_OPEN}\n${items}\n</urlset>`;
}

export function renderSitemapIndex(
  entries: { loc: string; lastmod?: string }[],
): string {
  const items = entries
    .map((e) => {
      const parts = [`  <sitemap>`, `    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      parts.push(`  </sitemap>`);
      return parts.join("\n");
    })
    .join("\n");
  return `${XML_HEADER}\n${SITEMAPINDEX_OPEN}\n${items}\n</sitemapindex>`;
}

export function buildMainUrls(): SitemapUrl[] {
  const now = new Date().toISOString();

  const staticRoutes: SitemapUrl[] = [
    { loc: BASE_URL, lastmod: now, changefreq: "weekly", priority: 1.0 },
    {
      loc: `${BASE_URL}/markets`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.9,
    },
    {
      loc: `${BASE_URL}/blog`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.8,
    },
    {
      loc: `${BASE_URL}/map`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.8,
    },
    {
      loc: `${BASE_URL}/scores`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.7,
    },
    {
      loc: `${BASE_URL}/scores/methodology`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.6,
    },
    {
      loc: `${BASE_URL}/market`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.6,
    },
    {
      loc: `${BASE_URL}/graphs`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.6,
    },
    {
      loc: `${BASE_URL}/pricing`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.6,
    },
    {
      loc: `${BASE_URL}/data`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.5,
    },
    {
      loc: `${BASE_URL}/about`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.5,
    },
    {
      loc: `${BASE_URL}/contact`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.4,
    },
    {
      loc: `${BASE_URL}/about/terms`,
      lastmod: now,
      changefreq: "yearly",
      priority: 0.2,
    },
  ];

  const blogRoutes: SitemapUrl[] = getAllPosts().map((post) => ({
    loc: `${BASE_URL}/blog/${post.slug}`,
    lastmod: new Date(post.frontmatter.date).toISOString(),
    changefreq: "monthly" as const,
    priority: 0.7,
  }));

  const comparisonRoutes: SitemapUrl[] = COMPARISONS.map((c) => ({
    loc: `${BASE_URL}/compare/${c.slug}`,
    lastmod: now,
    changefreq: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...blogRoutes, ...comparisonRoutes];
}

export function buildStatesUrls(): SitemapUrl[] {
  const now = new Date().toISOString();
  return [
    {
      loc: `${BASE_URL}/markets/state`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.8,
    },
    ...STATE_SLUG_DATA.map((s) => ({
      loc: `${BASE_URL}/markets/state/${s.slug}`,
      lastmod: now,
      changefreq: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

export function buildMetrosUrls(): SitemapUrl[] {
  const now = new Date().toISOString();
  return METRO_SLUG_DATA.map((metro) => ({
    loc: `${BASE_URL}/markets/${metro.slug}`,
    lastmod: now,
    changefreq: "weekly" as const,
    priority: 0.7,
  }));
}

export function buildCountiesUrls(): SitemapUrl[] {
  const now = new Date().toISOString();
  return COUNTY_SLUG_DATA.map((county) => ({
    loc: `${BASE_URL}/markets/county/${county.slug}`,
    lastmod: now,
    changefreq: "weekly" as const,
    priority: 0.5,
  }));
}

export function buildZipChunkUrls(chunkIndex: number): SitemapUrl[] {
  const now = new Date().toISOString();
  const start = chunkIndex * ZIPS_PER_SITEMAP;
  const end = start + ZIPS_PER_SITEMAP;
  return ZIP_SLUG_DATA.slice(start, end).map((zip) => ({
    loc: `${BASE_URL}/markets/zip/${zip.slug}`,
    lastmod: now,
    changefreq: "monthly" as const,
    priority: 0.4,
  }));
}

export function buildIndexEntries(): { loc: string; lastmod: string }[] {
  const now = new Date().toISOString();
  const entries = [
    { loc: `${BASE_URL}/sitemaps/main`, lastmod: now },
    { loc: `${BASE_URL}/sitemaps/states`, lastmod: now },
    { loc: `${BASE_URL}/sitemaps/metros`, lastmod: now },
    { loc: `${BASE_URL}/sitemaps/counties`, lastmod: now },
  ];
  for (let i = 0; i < ZIP_SITEMAP_COUNT; i++) {
    entries.push({
      loc: `${BASE_URL}/sitemaps/zips-${i + 1}`,
      lastmod: now,
    });
  }
  return entries;
}

export function buildSitemapById(id: string): SitemapUrl[] | null {
  if (id === "main") return buildMainUrls();
  if (id === "states") return buildStatesUrls();
  if (id === "metros") return buildMetrosUrls();
  if (id === "counties") return buildCountiesUrls();

  const zipMatch = /^zips-(\d+)$/.exec(id);
  if (zipMatch) {
    const chunkNumber = parseInt(zipMatch[1], 10);
    const chunkIndex = chunkNumber - 1;
    if (chunkIndex < 0 || chunkIndex >= ZIP_SITEMAP_COUNT) return null;
    return buildZipChunkUrls(chunkIndex);
  }

  return null;
}
