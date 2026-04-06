import type { MetadataRoute } from "next";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { COUNTY_SLUG_DATA } from "@/lib/data/county-slug-data";
import { ZIP_SLUG_DATA } from "@/lib/data/zip-slug-data";
import { STATE_SLUG_DATA } from "@/lib/data/state-slug-data";
import { getAllPosts } from "@/lib/blog";
import { COMPARISONS } from "@/lib/data/comparisons";

const BASE_URL = "https://www.propertyiq.app";

// Split ZIP sitemap into chunks of 10K URLs each.
// 39,499 ZIPs → 4 chunks. Smaller sitemaps help Google distribute crawl budget.
const ZIPS_PER_SITEMAP = 10000;
const ZIP_SITEMAP_COUNT = Math.ceil(ZIP_SLUG_DATA.length / ZIPS_PER_SITEMAP);

// Sitemap IDs (stable order so URLs don't change between deploys):
// 0 = main (static + blog + comparisons)
// 1 = states
// 2 = metros
// 3 = counties
// 4..N = zips chunks
const STATES_ID = 1;
const METROS_ID = 2;
const COUNTIES_ID = 3;
const ZIPS_START_ID = 4;

export async function generateSitemaps() {
  const ids: { id: number }[] = [
    { id: 0 },
    { id: STATES_ID },
    { id: METROS_ID },
    { id: COUNTIES_ID },
  ];
  for (let i = 0; i < ZIP_SITEMAP_COUNT; i++) {
    ids.push({ id: ZIPS_START_ID + i });
  }
  return ids;
}

export default function sitemap({ id }: { id: number }): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // ── Main sitemap: static routes + blog + comparisons ─────────────
  if (id === 0) {
    const staticRoutes: MetadataRoute.Sitemap = [
      {
        url: BASE_URL,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 1.0,
      },
      {
        url: `${BASE_URL}/markets`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.9,
      },
      {
        url: `${BASE_URL}/blog`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/map`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/scores`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      },
      {
        url: `${BASE_URL}/scores/methodology`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/market`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/graphs`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/pricing`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/data`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/about`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/contact`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.4,
      },
      {
        url: `${BASE_URL}/about/terms`,
        lastModified: now,
        changeFrequency: "yearly",
        priority: 0.2,
      },
    ];

    const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.frontmatter.date).toISOString(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    const comparisonRoutes: MetadataRoute.Sitemap = COMPARISONS.map((c) => ({
      url: `${BASE_URL}/compare/${c.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

    return [...staticRoutes, ...blogRoutes, ...comparisonRoutes];
  }

  // ── States ───────────────────────────────────────────────────────
  if (id === STATES_ID) {
    return [
      {
        url: `${BASE_URL}/markets/state`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      ...STATE_SLUG_DATA.map((s) => ({
        url: `${BASE_URL}/markets/state/${s.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  }

  // ── Metros ───────────────────────────────────────────────────────
  if (id === METROS_ID) {
    return METRO_SLUG_DATA.map((metro) => ({
      url: `${BASE_URL}/markets/${metro.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  }

  // ── Counties ─────────────────────────────────────────────────────
  if (id === COUNTIES_ID) {
    return COUNTY_SLUG_DATA.map((county) => ({
      url: `${BASE_URL}/markets/county/${county.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  }

  // ── ZIP chunks ───────────────────────────────────────────────────
  if (id >= ZIPS_START_ID && id < ZIPS_START_ID + ZIP_SITEMAP_COUNT) {
    const chunkIndex = id - ZIPS_START_ID;
    const start = chunkIndex * ZIPS_PER_SITEMAP;
    const end = start + ZIPS_PER_SITEMAP;
    return ZIP_SLUG_DATA.slice(start, end).map((zip) => ({
      url: `${BASE_URL}/markets/zip/${zip.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    }));
  }

  return [];
}
