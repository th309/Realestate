import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware
 *
 * - Refreshes the Supabase auth session on every matched request
 * - Redirects unauthenticated users away from protected routes
 * - Redirects authenticated users away from auth routes
 * - Blocks /_dev routes in production
 * - Rate-limits content-pipeline short-link traffic on /go/
 */

const PROTECTED_PREFIXES = [
  "/account",
  "/dashboard",
  "/alerts",
  "/reports",
  "/admin",
  "/upgrade",
];
const PUBLIC_PATHS = ["/reports/sample", "/reports/shared"];
const AUTH_ROUTES = ["/auth/sign-in", "/auth/sign-up", "/auth/forgot-password"];

/**
 * In-memory rate limiter for short-link redirects.
 *
 * LIMITATIONS:
 *  - Module-scoped Map; resets on every deploy.
 *  - Per-edge-instance (Railway / Vercel may scale horizontally), so the
 *    effective cap is `60 * instance_count` requests per minute per IP.
 *  - Fine for slug-enumeration defense (plan security review item);
 *    upgrade to Upstash Redis or similar for precise global limits.
 */
const SHORT_LINK_RATE_LIMIT = 60; // requests per window per IP
const SHORT_LINK_RATE_WINDOW_MS = 60_000;
const shortLinkHits = new Map<string, { count: number; resetAt: number }>();

function checkShortLinkRate(ip: string): boolean {
  const now = Date.now();
  const entry = shortLinkHits.get(ip);
  if (!entry || entry.resetAt < now) {
    shortLinkHits.set(ip, {
      count: 1,
      resetAt: now + SHORT_LINK_RATE_WINDOW_MS,
    });
    // Opportunistic eviction so the Map doesn't grow unbounded in a long-lived edge instance.
    if (shortLinkHits.size > 10_000) {
      for (const [key, value] of shortLinkHits) {
        if (value.resetAt < now) shortLinkHits.delete(key);
      }
    }
    return true;
  }
  entry.count++;
  return entry.count <= SHORT_LINK_RATE_LIMIT;
}

export async function middleware(request: NextRequest) {
  // Non-www → www redirect (301 permanent)
  const host = request.headers.get("host") || "";
  if (host === "propertyiq.app") {
    const url = request.nextUrl.clone();
    url.host = "www.propertyiq.app";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  // Short-link rate limit: 60 req/min per IP on the /go/ prefix.
  // Runs before Supabase session work so hot paths stay cheap.
  if (request.nextUrl.pathname.startsWith("/go/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    if (!checkShortLinkRate(ip)) {
      return new NextResponse("rate limited", {
        status: 429,
        headers: { "retry-after": "60" },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — must call getUser() to keep cookies in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Set a lightweight cookie the client can read synchronously to know
  // auth status without waiting for the async getSession() call.
  if (user) {
    supabaseResponse.cookies.set("piq-uid", user.id, {
      path: "/",
      httpOnly: false, // Must be readable by client JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day — middleware refreshes on every request anyway
    });
  } else {
    supabaseResponse.cookies.delete("piq-uid");
  }

  const { pathname } = request.nextUrl;

  // Permanent redirect: /get-started → /tour, preserving query params.
  if (pathname === "/get-started" || pathname.startsWith("/get-started/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/tour";
    return NextResponse.redirect(url, 308);
  }

  // Block /_dev routes in production
  if (pathname.startsWith("/_dev")) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
  }

  // Protected routes — redirect unauthenticated users to sign-in
  // Allow bypass in dev mode with ?bypass_auth=true param or cookie for visual testing
  const bypassParam = request.nextUrl.searchParams.has("bypass_auth");
  const bypassCookie = request.cookies.get("bypass_auth")?.value === "true";
  const bypassAuth =
    process.env.NODE_ENV !== "production" && (bypassParam || bypassCookie);
  if (bypassParam && !bypassCookie) {
    supabaseResponse.cookies.set("bypass_auth", "true", {
      path: "/",
      maxAge: 3600,
    });
  }

  const isProtectedPath = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isPublicPath =
    PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath)) ||
    pathname === "/reports";
  const isProtected = isProtectedPath && !isPublicPath;

  if (isProtected && !user && !bypassAuth) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Admin routes — require admin or super_admin role
  if (pathname.startsWith("/admin") && user) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!adminRow || !["admin", "super_admin"].includes(adminRow.role)) {
      return NextResponse.redirect(new URL("/map", request.url));
    }
  }

  // Auth routes — redirect authenticated users to map
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/map", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This ensures the non-www → www redirect fires on every page,
     * while auth/admin checks only apply to their specific prefixes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|xml|txt|json|geojson)$).*)",
  ],
};
