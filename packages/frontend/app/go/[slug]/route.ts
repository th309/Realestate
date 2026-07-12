import { NextResponse } from "next/server";

/**
 * Short-link redirect handler for the content pipeline.
 *
 * Looks up the slug via the backend resolver, sets the `__piq_attr`
 * attribution cookie, and 302 redirects to the target URL.
 *
 * NOTE: plan Task 1.29 specified `/s/[slug]/route.ts`, but the existing
 * `/s/[token]/page.tsx` share-redirect route already occupies the `/s/`
 * segment with a conflicting dynamic param name. Next.js forbids two
 * different dynamic param names at the same path level, so the short-link
 * handler lives at `/go/[slug]`. Middleware rate-limits `/go/` accordingly.
 *
 * Canonical short-link URL: https://piq.sh/go/<slug>
 *   (piq.sh is a planned standalone domain; until it is registered, short
 *   links are served from propertyiq.app/go/<slug>.)
 */

export const runtime = "edge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://backend-production-ee4d.up.railway.app";
const PROPERTYIQ_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://propertyiq.app";
const COOKIE_DOMAIN =
  process.env.NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN ?? ".propertyiq.app";

export async function GET(
  _request: Request,
  // Next's generated route stub requires the declared params type to be a
  // Promise (a union fails its ParamCheck). Runtime still tolerates the
  // legacy plain-object shape via Promise.resolve() below.
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await Promise.resolve(ctx.params);

  const res = await fetch(
    `${API_BASE}/api/internal/short-links/resolve/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as {
    success: boolean;
    data?: {
      run_id: string;
      slug: string;
      platform: string;
      target_url: string;
    };
  };

  if (!json.success || !json.data) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const data = json.data;
  const targetUrl = data.target_url.startsWith("http")
    ? data.target_url
    : `${PROPERTYIQ_ORIGIN}${data.target_url}`;
  const now = new Date();

  const cookieValue = JSON.stringify({
    runId: data.run_id,
    slug: data.slug,
    platform: data.platform,
    firstTouchAt: now.toISOString(),
  });

  const response = NextResponse.redirect(targetUrl, { status: 302 });
  response.cookies.set("__piq_attr", cookieValue, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    domain: COOKIE_DOMAIN,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: true,
  });
  return response;
}
