import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// /.well-known/oauth-protected-resource (RFC 9728). Reachable via a next.config
// rewrite. The protected resource is the PropertyIQ MCP server, so this apex copy
// mirrors the canonical document served by packages/mcp-server (oauth/metadata.ts)
// — letting agents that discover PropertyIQ at the marketing origin still find it.
export async function GET(): Promise<Response> {
  const { mcp } = AGENT_DISCOVERY;
  const resource = new URL(mcp.endpoint).origin;
  const doc = {
    resource,
    authorization_servers: [resource],
    scopes_supported: [...mcp.scopes],
    bearer_methods_supported: ["header"],
  };
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
