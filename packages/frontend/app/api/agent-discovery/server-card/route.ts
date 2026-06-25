import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// MCP Server Card (SEP-1649). Reachable at /.well-known/mcp/server-card.json via
// a next.config rewrite. Lets agents auto-discover the PropertyIQ MCP endpoint.
export async function GET(): Promise<Response> {
  const { mcp } = AGENT_DISCOVERY;
  const card = {
    serverInfo: { name: mcp.name, version: mcp.version },
    transport: { type: mcp.transport, endpoint: mcp.endpoint },
    capabilities: { tools: {} },
    authentication: { type: mcp.auth, metadata: mcp.oauthProtectedResource },
    documentation: mcp.docs,
  };
  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
