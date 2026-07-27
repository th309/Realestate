/**
 * Sitemap URLs for the blog facet pages: /blog/archive[/year[/month]] and
 * /blog/states[/state]. Facet pages carry the newest contained post's date as
 * an honest <lastmod> (see sitemap-builder.ts header for the honesty policy).
 */
import { getAllPosts } from "@/lib/blog";
import {
  getArchiveTree,
  getStateIndex,
  getPostsByMonth,
  getPostsByState,
  NATIONAL_SLUG,
} from "@/lib/blog/archive";
import type { SitemapUrl } from "./sitemap-xml";

const BASE_URL = "https://www.propertyiq.app";

function isoOrUndefined(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function buildBlogFacetUrls(): SitemapUrl[] {
  const posts = getAllPosts();
  if (posts.length === 0) return [];
  const urls: SitemapUrl[] = [];
  const newestOverall = isoOrUndefined(posts[0]?.frontmatter.date);

  urls.push({ loc: `${BASE_URL}/blog/archive`, lastmod: newestOverall });
  for (const year of getArchiveTree()) {
    const newestInYear = posts.find((p) =>
      p.frontmatter.date.startsWith(year.year),
    );
    urls.push({
      loc: `${BASE_URL}/blog/archive/${year.year}`,
      lastmod: isoOrUndefined(newestInYear?.frontmatter.date),
    });
    for (const m of year.months) {
      urls.push({
        loc: `${BASE_URL}/blog/archive/${year.year}/${m.month}`,
        lastmod: isoOrUndefined(
          getPostsByMonth(year.year, m.month)[0]?.frontmatter.date,
        ),
      });
    }
  }

  const { states, nationalCount } = getStateIndex();
  urls.push({ loc: `${BASE_URL}/blog/states`, lastmod: newestOverall });
  for (const s of states) {
    urls.push({
      loc: `${BASE_URL}/blog/states/${s.slug}`,
      lastmod: isoOrUndefined(getPostsByState(s.slug)[0]?.frontmatter.date),
    });
  }
  if (nationalCount > 0) {
    urls.push({
      loc: `${BASE_URL}/blog/states/${NATIONAL_SLUG}`,
      lastmod: isoOrUndefined(
        getPostsByState(NATIONAL_SLUG)[0]?.frontmatter.date,
      ),
    });
  }
  return urls;
}
