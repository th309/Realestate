import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// /.well-known/oauth-protected-resource (RFC 9728). Reachable via a next.config
// rewrite. Identifies the marketing origin as a protected resource whose access
// tokens are issued by the PropertyIQ MCP authorization server. RFC 9728 requires
// the `resource` value to match the origin that served this document, so this copy
// self-identifies as the marketing origin — strict validators (e.g. isitagentready)
// reject a cross-origin `resource` as an origin mismatch. The MCP host serves its
// own origin-matching copy for the protected MCP endpoint itself
// (packages/mcp-server/src/lib/oauth/metadata.ts).
export async function GET(): Promise<Response> {
  const { mcp, siteOrigin } = AGENT_DISCOVERY;
  const authServer = new URL(mcp.endpoint).origin;
  const doc = {
    resource: siteOrigin,
    authorization_servers: [authServer],
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
