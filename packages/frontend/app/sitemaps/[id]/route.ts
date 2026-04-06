import { notFound } from "next/navigation";
import { buildSitemapById, renderUrlset } from "@/lib/seo/sitemap-builder";

// Cache for 1 hour at the edge; revalidate on next request after that.
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const urls = buildSitemapById(id);
  if (!urls) notFound();

  const xml = renderUrlset(urls);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
