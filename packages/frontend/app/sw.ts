/**
 * Serwist service worker entry (InjectManifest `swSrc`, see next.config.mjs).
 *
 * Precaches the Next.js build output (`self.__SW_MANIFEST`, injected at build
 * time) plus Serwist's Next-aware runtime caching (`defaultCache`), and falls
 * back to the branded `/offline` page for navigation requests that fail
 * while offline.
 *
 * IMPORTANT: `skipWaiting` is intentionally NOT set — a new worker must stay
 * in the "waiting" state until the user opts in via the update toast (see
 * lib/pwa/register-service-worker.ts + app/components/pwa/ServiceWorkerManager.tsx).
 * It only skips waiting in response to an explicit `{ type: "SKIP_WAITING" }`
 * message, which this file listens for below.
 *
 * Type-checked separately from the main app under tsconfig.worker.json (this
 * file needs the "webworker" lib, which conflicts with the app's "dom" lib);
 * see tsconfig.json's `exclude` entry for app/sw.ts.
 */
import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistPlugin,
  SerwistGlobalConfig,
} from "serwist";

import { registerPushHandlers } from "./sw-push";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Runtime cache holding stale-while-revalidate `/backend` GET responses (see
 * `backendSwrAllowlist` below). Named so the sign-out purge (`PIQ_CLEAR_API_CACHE`
 * message, handled at the bottom of this file) can target it without
 * depending on Serwist's internal cache-name derivation.
 */
const BACKEND_API_CACHE_NAME = "piq-backend-api";

/**
 * Pathname prefixes (relative to this app's same-origin `/backend` proxy —
 * see `lib/data/fetchers/api-url.ts`) safe to stale-while-revalidate: public,
 * unauthenticated, non-personalized metric/market read endpoints only.
 *
 * Every entry here was verified against its NestJS controller in
 * packages/backend/src — no `@UseGuards`, and where the controller sets an
 * explicit `Cache-Control` header it says `public`. Do NOT extend this list
 * without the same check: several backend routes look like public market
 * data but are tier-gated (see the `/api/scores/*` comment below and the
 * `api/screener/*` exclusion — ZIP-level screener data is Pro-only and
 * 403s free users, so caching it would leak a Pro response to whoever uses
 * this browser next).
 */
const CACHEABLE_BACKEND_PREFIXES = [
  // Metric snapshot/timeseries source proxies. Every metric's `apiEndpoint`
  // in lib/data/metrics/*.ts resolves under one of these six namespaces
  // (metrics, zillow, realtor, census, economic, permits controllers carry
  // no auth guards).
  "/backend/api/metrics/",
  "/backend/api/zillow/",
  "/backend/api/realtor/",
  "/backend/api/census/",
  "/backend/api/economic/",
  "/backend/api/permits/",
  "/backend/api/timeseries/",
  // PropertyIQ score endpoints — ONLY the literal sub-paths the backend
  // itself marks `Cache-Control: public` (ScoringMarketsController's
  // top/search/distribution, ScoringHeatmapController's heatmap/:geography,
  // and ScoringController's all/:geography + ids/:geography routes).
  // The bare `/api/scores`, `/api/scores/batch/:geo`, and the
  // `/api/scores/:geo/:id` catch-all are `OptionalJwtAuthGuard` +
  // `Cache-Control: private` — the response body includes a paid-tier-only
  // `components` breakdown, so caching those would serve one user's
  // breakdown to the next person on this device. NEVER widen this to a bare
  // "/backend/api/scores/" prefix.
  "/backend/api/scores/all/",
  "/backend/api/scores/ids/",
  "/backend/api/scores/top",
  "/backend/api/scores/search",
  "/backend/api/scores/distribution",
  "/backend/api/scores/heatmap/",
  // Market/geography data — markets, market-snapshot, benchmarks, migration,
  // and geography controllers carry no auth guards.
  "/backend/api/markets/",
  "/backend/markets/", // legacy no-/api/ list routes (fetchMarketsMetros etc.)
  "/backend/api/market-snapshot/",
  "/backend/api/benchmarks/",
  "/backend/api/migration/",
  "/backend/api/geography/",
  "/backend/api/health/data-freshness",
];

/**
 * Response-level backstop for the pathname allowlist above: even if a future
 * metric or route slips into an allowlisted prefix while carrying per-user
 * data, refuse to persist it unless the backend's own response says it's
 * safe — mirrors the pathname allowlist's intent using the backend's own
 * signal instead of trusting the URL alone. The `/backend` proxy
 * (app/backend/[[...path]]/route.ts) forwards `Cache-Control` and
 * `Content-Type` from the upstream response untouched, so both checks below
 * see the real backend values.
 */
const publicResponseOnly: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) => {
    if (!response.ok) return null;
    const cacheControl = response.headers.get("cache-control") ?? "";
    if (/\bprivate\b|\bno-store\b/i.test(cacheControl)) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) return null;
    return response;
  },
};

/**
 * True when `pathname` matches `prefix`: either `prefix` is a directory-style
 * entry (ends in "/", matching anything nested under it), or `pathname`
 * equals `prefix` exactly, or continues past it at a "/" boundary. Plain
 * `pathname.startsWith(prefix)` would let a literal terminal route like
 * "/backend/api/scores/top" also match an unrelated future sibling such as
 * "/backend/api/scores/top-performers".
 */
function pathMatchesAllowlistPrefix(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) return false;
  if (prefix.endsWith("/")) return true;
  const nextChar = pathname.charAt(prefix.length);
  return nextChar === "" || nextChar === "/";
}

// Phase-4.1: stale-while-revalidate for the public metric/market read
// endpoints enumerated above. Excludes NDJSON stream routes (path ends in
// "/stream") since those are unbounded/large and not meant to be cached.
// MUST stay before `backendNetworkOnly` below — Serwist checks runtimeCaching
// rules in array order and uses the first match.
const backendSwrAllowlist: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) =>
    sameOrigin &&
    !url.pathname.endsWith("/stream") &&
    CACHEABLE_BACKEND_PREFIXES.some((prefix) =>
      pathMatchesAllowlistPrefix(url.pathname, prefix),
    ),
  method: "GET",
  handler: new StaleWhileRevalidate({
    cacheName: BACKEND_API_CACHE_NAME,
    plugins: [
      publicResponseOnly,
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 24 * 60 * 60,
        maxAgeFrom: "last-used",
      }),
    ],
  }),
};

// Supabase Storage signed URLs (post images, metro-hero skylines, brand assets)
// load cross-origin via <img>, so the browser returns OPAQUE responses.
// defaultCache's generic cross-origin route runs Serwist's copyResponse on them,
// which throws `cross-origin-copy-response` on an opaque body — the handler then
// synthesizes a 503, so those images fail even though the URL is fine (direct
// curl 200), and the app flips to its offline banner. Serve these straight from
// the network with no plugins and no copying. Signed URLs are unique per mint,
// so caching them would be pure waste anyway. MUST stay before `...defaultCache`.
const supabaseStorageNetworkOnly: RuntimeCaching = {
  matcher: ({ url }) =>
    url.hostname.endsWith(".supabase.co") &&
    url.pathname.startsWith("/storage/"),
  handler: new NetworkOnly(),
};

// `/backend/*` is this app's same-origin API proxy
// (app/backend/[[...path]]/route.ts). defaultCache's same-origin "others"
// NetworkFirst catch-all would otherwise cache its GETs — its own `/api/`
// guard is a different prefix and doesn't cover this proxy. Everything not
// covered by `backendSwrAllowlist` above (entitlement-gated, user-scoped,
// admin, AI, SSE) stays NetworkOnly — byte-identical to having no service
// worker for those requests. MUST stay before `defaultCache` in the array
// below.
const backendNetworkOnly: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.startsWith("/backend/"),
  method: "GET",
  handler: new NetworkOnly(),
};

// Phase-4.4: CacheFirst for the static GeoJSON boundary files served from
// /public/geojson (national/state/metro/county-without-state — see
// getGeojsonUrl in app/(app)/map/utils/geojson-fetch.ts). These are
// build-time-generated and effectively immutable between deploys, so
// CacheFirst (skip the network once cached) is appropriate — unlike the
// dynamic per-state county/city/zip GeoJSON, which goes through the
// `/backend/api/geography/*` SWR rule above instead.
const geojsonCacheFirst: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) =>
    sameOrigin &&
    url.pathname.startsWith("/geojson/") &&
    url.pathname.endsWith(".json"),
  method: "GET",
  handler: new CacheFirst({
    cacheName: "piq-geojson-static",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 7 * 24 * 60 * 60,
        maxAgeFrom: "last-used",
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    supabaseStorageNetworkOnly,
    backendSwrAllowlist,
    backendNetworkOnly,
    geojsonCacheFirst,
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data?.type === "PIQ_CLEAR_API_CACHE") {
    // Sign-out purge (see lib/pwa/clear-sw-api-cache.ts) — a stale cached
    // `/backend` response from the outgoing user's session must not be
    // served to whoever uses this browser next.
    event.waitUntil(caches.delete(BACKEND_API_CACHE_NAME));
  }
});

// Push notifications + notification-click handling (see app/sw-push.ts —
// split out to stay under the 300-line logic-file limit).
registerPushHandlers();

serwist.addEventListeners();
