/**
 * API URL RESOLUTION
 *
 * Single source of truth for where browser/server data-layer requests are sent.
 * Extracted from `base.ts` so the fetch wrappers stay focused on transport.
 */

/**
 * Default API origin when NEXT_PUBLIC_API_URL was not set at build time.
 * Production builds must still set NEXT_PUBLIC_API_URL explicitly when the API host changes.
 *
 * Without this, the client bundle falls back to localhost — which breaks deployed sites
 * (browser tries each user's own machine, producing "Failed to fetch").
 */
const DEFAULT_PRODUCTION_API_URL =
  "https://backend-production-ee4d.up.railway.app";

/**
 * Same-origin path prefix proxied to the backend by the Next.js route handler
 * at `app/backend/[[...path]]/route.ts`.
 *
 * WHY THIS EXISTS — ad-blocker resilience (the permanent fix):
 * The backend lives on a *different site* than the frontend
 * (`backend-*.up.railway.app` vs `www.propertyiq.app`). Railway publishes
 * `up.railway.app` on the Public Suffix List, so the two hosts are genuinely
 * cross-site. Browser ad blockers / privacy extensions classify a cross-site
 * `fetch` to a hash-named host as a third-party tracker and reject it before it
 * leaves the browser — surfacing as `TypeError: Failed to fetch` (from the
 * extension's injected fetch wrapper, e.g. `injectScriptAdjust.js`).
 *
 * Routing every *browser* request through a first-party, same-origin prefix
 * removes that entire failure class: the browser only ever talks to its own
 * origin, and the Next.js server (where no ad blocker runs) proxies the call to
 * the real backend. This is the single chokepoint — every fetcher builds its
 * URL from `API_URL`, so redefining it here fixes all call sites at once.
 *
 * MUST stay in sync with the route handler at `app/backend/[[...path]]/route.ts`
 * and the matcher exclusion in `middleware.ts`.
 */
export const SAME_ORIGIN_BACKEND_PREFIX = "/backend";

/**
 * Absolute backend origin — used server-side (SSR / ISR / route handlers) and
 * by the `/backend` proxy. Node.js runtime only: do not call from Edge-runtime
 * code, where `process.env.NODE_ENV` and env injection differ.
 */
export function resolveBackendOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_API_URL;
  }
  return "http://localhost:3001";
}

function resolveApiUrl(): string {
  // Browser: first-party same-origin prefix so ad blockers never see a
  // cross-site request to the backend host. Next.js rewrites it to the backend.
  if (typeof window !== "undefined") {
    return `${window.location.origin}${SAME_ORIGIN_BACKEND_PREFIX}`;
  }
  // Server (SSR, ISR, route handlers): call the backend directly — no browser,
  // no ad blocker, and an absolute URL is required.
  return resolveBackendOrigin();
}

/**
 * API base URL.
 * - Browser: `<origin>/backend` — a first-party URL Next.js proxies to the
 *   backend (ad-blocker safe). See {@link SAME_ORIGIN_BACKEND_PREFIX}.
 * - Server: the absolute backend origin (NEXT_PUBLIC_API_URL → prod default → localhost).
 */
export const API_URL = resolveApiUrl();
