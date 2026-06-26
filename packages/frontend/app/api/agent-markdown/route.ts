import { resolveMarkdown } from "@/lib/agent-markdown/resolve";

// Markdown representation endpoint. middleware.ts rewrites content requests that
// carry `Accept: text/markdown` here, forwarding the original path via the
// `x-md-pathname` request header (a rewrite's query params don't reach here —
// request.url stays the original URL).
export async function GET(request: Request): Promise<Response> {
  const pathname = request.headers.get("x-md-pathname") ?? "";
  const markdown = resolveMarkdown(pathname);
  if (markdown === null) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      Vary: "Accept",
      "x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
    },
  });
}
