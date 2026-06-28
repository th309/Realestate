import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// /auth.md — agent authentication guide (WorkOS auth.md convention), served as
// text/markdown so agents can discover how to authenticate to PropertyIQ.
export async function GET(): Promise<Response> {
  const { siteOrigin, mcp } = AGENT_DISCOVERY;
  const mcpOrigin = new URL(mcp.endpoint).origin;
  const body = `# PropertyIQ auth.md — Agent Authentication

PropertyIQ exposes its real-estate analytics to agents two ways.

## MCP (recommended for AI agents)

- Endpoint: \`${mcp.endpoint}\` (transport: ${mcp.transport})
- Auth: OAuth 2.1 + PKCE with dynamic client registration (RFC 7591).
  - Register: \`${mcpOrigin}/register\`
  - Authorize: \`${mcpOrigin}/authorize\`
  - Token: \`${mcpOrigin}/token\`
- Discovery metadata:
  - Protected resource (RFC 9728): ${mcp.oauthProtectedResource}
  - Authorization server (RFC 8414): ${mcp.oauthAuthorizationServer}
- Docs: ${mcp.docs}

## Agent registration (machine-readable)

The \`agent_auth\` profile below mirrors the block in the authorization-server
metadata (RFC 8414). Register a client at \`register_uri\` (RFC 7591), then run the
OAuth 2.1 + PKCE authorization-code flow to obtain an access token.

\`\`\`json
{
  "agent_auth": {
    "skill": "${siteOrigin}/auth.md",
    "register_uri": "${mcpOrigin}/register",
    "claim_uri": "${mcpOrigin}/token",
    "identity_types_supported": ["anonymous"],
    "anonymous": {
      "credential_types_supported": ["oauth2_access_token", "api_key"]
    }
  }
}
\`\`\`

## Platform API (REST)

- Authenticate with a bearer API key prefixed \`piq_live_\`.
- Get a key and the base URL from the API docs: ${siteOrigin}/docs/api

## Discovery

- API catalog: ${siteOrigin}/.well-known/api-catalog
- MCP server card: ${siteOrigin}/.well-known/mcp/server-card.json
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
