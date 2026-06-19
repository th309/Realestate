/**
 * XML rendering for sitemaps.
 *
 * Pure serialization helpers — the URL *content* is assembled in
 * sitemap-builder.ts; this file only turns it into spec-compliant XML.
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  // <changefreq>/<priority> intentionally omitted (L1): Google ignores both,
  // and emitting them across ~43,700 URLs added ~2.5MB of dead bytes.
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
