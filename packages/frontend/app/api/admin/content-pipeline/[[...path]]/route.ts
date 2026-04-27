/**
 * Proxies admin Content Pipeline traffic to the NestJS backend so the browser
 * uses same-origin `/api/admin/content-pipeline/...` requests (no CORS).
 *
 * Without this, client-side `fetch(NEXT_PUBLIC_API_URL + '/api/admin/...')`
 * cross-origin requests often fail as "Failed to fetch" (CORS, cookies, VPN).
 */

import { NextRequest, NextResponse } from "next/server";

function backendOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "http://localhost:3001";
  return raw.replace(/\/$/, "");
}

function buildTargetUrl(
  request: NextRequest,
  pathSegments: string[] | undefined,
): string {
  const safe = (pathSegments ?? []).filter((s) => s.length > 0 && !s.includes(".."));
  const sub = safe.join("/");
  const backendPath = sub
    ? `/api/admin/content-pipeline/${sub}`
    : `/api/admin/content-pipeline`;
  return `${backendOrigin()}${backendPath}${request.nextUrl.search}`;
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
  const targetUrl = buildTargetUrl(request, pathSegments);

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) {
    headers.set("Authorization", auth);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch (err) {
    console.error("[content-pipeline proxy] upstream fetch failed:", targetUrl, err);
    return NextResponse.json(
      { success: false, error: "Backend unreachable" },
      { status: 502 },
    );
  }

  const out = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) out.set("Content-Type", ct);

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
