import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { markdownNegotiationRewrite } from "@/lib/agent-markdown/negotiate";

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

/**
 * True if `userId` holds an admin or super_admin role in `admin_users`.
 * Shared by the page-level `/admin` guard and the `/api/admin` API guard.
 */
async function isAdminUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", userId)
    .single();
  return !!data && ["admin", "super_admin"].includes(data.role);
}

export async function middleware(request: NextRequest) {
  // Canonical-host redirects — consolidate duplicate hosts onto
  // www.propertyiq.app so Google never indexes the bare apex or the Railway
  // deploy alias (H3; the alias serves byte-identical copies of every page).
  // Railway's own healthcheck uses Host: healthcheck.railway.app, which does
  // NOT match, so this never interferes with deploys.
  const host = request.headers.get("host") || "";
  if (host === "propertyiq.app") {
    const url = request.nextUrl.clone();
    url.host = "www.propertyiq.app";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  if (host === "propertyiq.up.railway.app") {
    const url = request.nextUrl.clone();
    url.host = "www.propertyiq.app";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Markdown for Agents: serve the markdown SOURCE to agents that ask for it via
  // `Accept: text/markdown`; browsers fall through to HTML. Runs before the
  // Supabase session refresh — markdown content is public.
  const markdownRewrite = markdownNegotiationRewrite(request);
  if (markdownRewrite) return markdownRewrite;

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

  // NOTE: `/` is deliberately not special-cased. The landing A/B split that used
  // to assign a sticky `piq-variant` cookie here and rewrite `/` to the variant
  // route is retired — there is one homepage, rendered directly by
  // app/(app)/page.tsx. Reintroducing a rewrite here fails the guards in
  // __tests__/landing-ab-retired.test.ts.

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

  // Admin pages — require admin or super_admin role
  if (pathname.startsWith("/admin") && user) {
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.redirect(new URL("/map", request.url));
    }
  }

  // Admin API routes use the service-role client, so guard them here with JSON
  // 401/403 (not a redirect a fetch() can't act on). The page-level `/admin`
  // guard above misses them because the path starts with `/api`, not `/admin`.
  // Excludes `/api/admin/content-pipeline`, which forwards Authorization to the
  // backend where its own guard lives (incl. the session-less OAuth callback).
  if (
    pathname.startsWith("/api/admin") &&
    !pathname.startsWith("/api/admin/content-pipeline")
  ) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
     *
     * `backend` is excluded: it is the same-origin proxy prefix forwarded to the
     * backend by app/backend/[[...path]]/route.ts (see lib/data/fetchers/api-url.ts).
     * Running the Supabase session refresh on every proxied data request would
     * add a getUser() round-trip per call for no benefit.
     *
     * `sw.js`/`sw.js.map` is excluded: the Serwist service worker script
     * (next.config.mjs / app/sw.ts) must be served with no auth/redirect
     * logic in front of it, or install/update can fail.
     */
    "/((?!backend/|_next/static|_next/image|favicon.ico|sw\\.js(?:\\.map)?|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|xml|txt|json|geojson)$).*)",
    // Belt-and-suspenders for the admin API guard: the exclusion regex above
    // drops ANY path ending in a static extension (.json/.txt/.xml/...), which
    // would otherwise let `/api/admin/<route>/<id>.json` skip middleware — and
    // thus the admin auth guard — entirely (the [id] segment swallows the
    // suffix). Matcher entries are OR'd, so this unconditional entry guarantees
    // the guard runs on every /api/admin/* request regardless of trailing suffix.
    "/api/admin/:path*",
  ],
};
