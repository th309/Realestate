import {
  buildIndexEntries,
  renderSitemapIndex,
} from "@/lib/seo/sitemap-builder";

// Cache for 1 hour at the edge; revalidate on next request after that.
export const revalidate = 3600;

export function GET() {
  const xml = renderSitemapIndex(buildIndexEntries());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
