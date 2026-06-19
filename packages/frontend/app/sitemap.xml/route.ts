import { buildIndexEntries } from "@/lib/seo/sitemap-builder";
import { renderSitemapIndex } from "@/lib/seo/sitemap-xml";

// Cache for 1 hour at the edge; revalidate on next request after that.
export const revalidate = 3600;

export async function GET() {
  const xml = renderSitemapIndex(await buildIndexEntries());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
