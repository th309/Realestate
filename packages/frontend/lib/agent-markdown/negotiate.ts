import { type NextRequest, NextResponse } from "next/server";

// Markdown-for-Agents content negotiation. Extracted from middleware.ts so the
// decision logic is unit-testable and middleware stays within the file-size
// limit. Supported content routes are the ones with a markdown source
// (see lib/agent-markdown/resolve).
const BLOG_POST = /^\/blog\/[^/]+$/;

export function isMarkdownContentRoute(pathname: string): boolean {
  return BLOG_POST.test(pathname) || pathname === "/scores/methodology";
}

export function wantsMarkdown(acceptHeader: string | null): boolean {
  return !!acceptHeader && acceptHeader.includes("text/markdown");
}

// If the request asks for markdown on a supported content route, return a rewrite
// to the markdown route handler (carrying the original path + `Vary: Accept`).
// Otherwise null — the caller continues to the normal HTML render.
export function markdownNegotiationRewrite(
  request: NextRequest,
): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!isMarkdownContentRoute(pathname)) return null;
  if (!wantsMarkdown(request.headers.get("accept"))) return null;

  // Forward the original path via a request header — a rewrite's added query
  // params don't reach the destination (its request.url stays the original URL),
  // but overridden request headers do.
  const headers = new Headers(request.headers);
  headers.set("x-md-pathname", pathname);
  const url = request.nextUrl.clone();
  url.pathname = "/api/agent-markdown";
  const rewrite = NextResponse.rewrite(url, { request: { headers } });
  // Vary: Accept on the markdown representation is the load-bearing cache header.
  // The HTML page response can't reliably carry it (Next manages page-response
  // Vary for RSC and overrides middleware/config-set values) — acceptable because
  // middleware runs per-request on the deployment, so a shared cache never
  // cross-serves the HTML and markdown representations of one URL.
  rewrite.headers.set("Vary", "Accept");
  return rewrite;
}
