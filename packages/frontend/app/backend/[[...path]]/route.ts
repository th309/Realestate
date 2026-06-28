/**
 * SAME-ORIGIN BACKEND PROXY  (`/backend/*`)
 *
 * Ad-blocker resilience — the permanent fix for "Failed to fetch".
 *
 * The backend lives on a *different site* than the frontend
 * (`backend-*.up.railway.app` vs `www.propertyiq.app`; Railway publishes
 * `up.railway.app` on the Public Suffix List, so they are genuinely cross-site).
 * Browser ad blockers / privacy extensions reject cross-site `fetch`es to a
 * hash-named host as third-party trackers, surfacing as `TypeError: Failed to
 * fetch` from their injected fetch wrapper (e.g. `injectScriptAdjust.js`).
 *
 * The data layer builds every browser URL as `<origin>/backend/...` (see
 * `lib/data/fetchers/api-url.ts`), so requests are first-party and never blocked.
 * This handler forwards them to the real backend from the Next.js server, where
 * no ad blocker runs.
 *
 * Why a route handler instead of a `next.config` rewrite: the config rewrite
 * streams responses chunked and *intermittently truncated* large payloads
 * (e.g. the ~630 KB county snapshot) on reused keep-alive connections — silent
 * data corruption with no error. Buffering non-stream responses here gives every
 * reply a correct `Content-Length`, so they are always complete. Server-Sent
 * Event streams (analyzer AI endpoints) are passed through untouched.
 *
 * `/backend` is excluded from the middleware matcher so this hot path skips the
 * per-request Supabase session refresh.
 */

import { NextRequest, NextResponse } from "next/server";

import { resolveBackendOrigin } from "@/lib/data/fetchers/api-url";

export const dynamic = "force-dynamic";

// Hop-by-hop / fetch-managed request headers that must not be forwarded.
// `cookie` is stripped on purpose: the backend authenticates via the
// `Authorization: Bearer <jwt>` header (forwarded), and the frontend's
// Supabase/`piq-uid` cookies are bound to the frontend origin — they never
// reached the backend under the old cross-origin flow and must not start now.
const SKIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "cookie",
  // Client-asserted tier is a spoofing vector for tier-gated routes. The backend
  // derives the authoritative tier server-side; the frontend only sends this
  // header for paywall analytics, so dropping it here costs nothing functional.
  // Defense-in-depth: the server-side fix landed 2026-06-27 — `scoring.guard.ts`
  // no longer trusts `x-user-tier`/`?userTier` and fails closed to `free` — but
  // we keep stripping it at the proxy so the browser path never carries it.
  "x-user-tier",
]);

// Response headers we set ourselves (or that don't survive decompression).
const SKIP_RESPONSE_HEADERS = new Set([
  "connection",
  "transfer-encoding",
  "content-encoding", // body is already decompressed by fetch()
  "content-length", // re-set from the buffered body
  "set-cookie", // the backend must not set cookies on the frontend origin
]);

function forwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

function copyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
  const safe = (pathSegments ?? []).filter(
    (segment) => segment.length > 0 && !segment.includes(".."),
  );
  // Single source of truth for the backend origin — same resolver SSR fetches
  // use, so the proxy and direct server-side calls can never diverge.
  const targetUrl = `${resolveBackendOrigin()}/${safe.join("/")}${request.nextUrl.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: forwardRequestHeaders(request),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    console.error("[backend proxy] upstream fetch failed:", targetUrl, err);
    return NextResponse.json(
      { success: false, error: "Backend unreachable" },
      { status: 502 },
    );
  }

  const headers = copyResponseHeaders(upstream);
  const contentType = upstream.headers.get("content-type") ?? "";

  // Server-Sent Events (analyzer AI streams): pass the body through untouched.
  if (contentType.includes("text/event-stream")) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  // Everything else: buffer fully so the response is always complete
  // (correct Content-Length, no chunked-stream truncation).
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers });
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: RouteContext) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: RouteContext) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  return proxy(request, (await ctx.params).path);
}
export async function HEAD(request: NextRequest, ctx: RouteContext) {
  return proxy(request, (await ctx.params).path);
}
