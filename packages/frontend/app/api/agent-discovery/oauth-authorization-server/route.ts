import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// /.well-known/oauth-authorization-server (RFC 8414). Reachable via a next.config
// rewrite. Mirrors the canonical document served by packages/mcp-server
// (oauth/metadata.ts): `issuer` is the MCP host, where the authorize/token/register
// endpoints actually live, and it matches the `authorization_servers` entry in the
// protected-resource metadata. Strict OAuth clients follow that protected-resource
// link to the MCP host's own (origin-matching) copy; this apex copy exists for
// agents and auditors that probe the marketing origin directly.
export async function GET(): Promise<Response> {
  const { mcp, siteOrigin } = AGENT_DISCOVERY;
  const issuer = new URL(mcp.endpoint).origin;
  const doc = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    // agent_auth profile (WorkOS auth.md convention). PropertyIQ's real agent-auth
    // model is OAuth 2.1 + PKCE with dynamic client registration (RFC 7591), so the
    // identity/claim endpoints map to the real, resolving OAuth endpoints: an agent
    // establishes its identity by registering a client, and a user "claims" (delegates
    // to) that agent at the authorize endpoint. `identity_types_supported` uses the
    // schema's `service_auth` value (machine clients with their own credentials).
    agent_auth: {
      skill: `${siteOrigin}/auth.md`,
      // agent_auth follows the WorkOS auth.md schema the isitagentready check
      // validates. PropertyIQ uses open OAuth 2.1 dynamic client registration
      // (RFC 7591, public clients) — an agent provisions its own credentials
      // without proving a human identity — which is the recognized "anonymous"
      // method: register at `register_uri`, then claim a token at `claim_uri`.
      register_uri: `${issuer}/register`,
      claim_uri: `${issuer}/token`,
      identity_types_supported: ["anonymous"],
      anonymous: {
        credential_types_supported: ["oauth2_access_token", "api_key"],
      },
    },
  };
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
