import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

// revalidatePath is server-only; keep this handler on the Node runtime and never
// cached so the backend cron can invalidate the market pages on demand.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Passing a dynamic route's literal path + "page" revalidates EVERY dynamic
// instance of that route — so these few calls cover all ~35k market pages.
const MARKET_ROUTES = [
  "/markets/[slug]",
  "/markets/county/[slug]",
  "/markets/zip/[slug]",
  "/markets/state/[state]",
] as const;

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // No secret configured — refuse rather than allow unauthenticated purges.
    return NextResponse.json(
      { error: "Revalidation is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bust the tagged data cache first (covers every page using the cacheable SEO
  // fetches), then the route caches. Tag = SEO_MARKET_CACHE_TAG in
  // lib/data/fetchers/market-stats.ts (literal here to keep this route dependency-free).
  // Cast to the documented runtime signature (1 arg); local next types disagree
  // on arity but the build (ignoreBuildErrors) + runtime use revalidateTag(tag).
  (revalidateTag as (tag: string) => void)("piq-market-data");
  for (const route of MARKET_ROUTES) {
    revalidatePath(route, "page");
  }
  revalidatePath("/markets", "page");

  return NextResponse.json({
    revalidated: true,
    tags: ["piq-market-data"],
    routes: [...MARKET_ROUTES, "/markets"],
  });
}
