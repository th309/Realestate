import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// API catalog (RFC 9727 / RFC 9264 linkset). Reachable at /.well-known/api-catalog
// via a next.config rewrite. v1 advertises the PropertyIQ MCP service only.
export async function GET(): Promise<Response> {
  const { mcp } = AGENT_DISCOVERY;
  const linkset = {
    linkset: [
      {
        anchor: mcp.endpoint,
        "service-desc": [{ href: mcp.openapi, type: "application/json" }],
        "service-doc": [{ href: mcp.docs, type: "text/html" }],
        status: [{ href: mcp.health, type: "application/json" }],
      },
    ],
  };
  return new Response(JSON.stringify(linkset, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
