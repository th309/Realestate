import { resolveMarkdown } from "@/lib/agent-markdown/resolve";

// Markdown representation endpoint. middleware.ts rewrites content requests that
// carry `Accept: text/markdown` here, forwarding the original path as ?path=.
export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const markdown = resolveMarkdown(path);
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
