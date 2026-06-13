import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

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

  for (const route of MARKET_ROUTES) {
    revalidatePath(route, "page");
  }
  revalidatePath("/markets");

  return NextResponse.json({
    revalidated: true,
    routes: [...MARKET_ROUTES, "/markets"],
  });
}
