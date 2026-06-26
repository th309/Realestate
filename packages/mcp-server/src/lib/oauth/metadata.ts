const BASE_URL = process.env.MCP_BASE_URL || "https://mcp.propertyiq.app";

/**
 * Derive the server URL from the incoming request's host headers.
 *
 * Both well-known endpoints must report a URL that matches the URL the
 * client actually fetched the metadata from:
 *   • RFC 9728 (protected-resource metadata) — the `resource` field must
 *     equal the connection URL or be its origin ancestor.
 *   • RFC 8414 §2 (authorization-server metadata) — the `issuer` field
 *     must be byte-for-byte equal to the URL the well-known document was
 *     fetched from. Strict OAuth client libraries reject any mismatch as
 *     a metadata-spoofing signal.
 *
 * Since this server is reachable on multiple hostnames (custom domain +
 * Railway URL), we return whichever URL the client actually used. All
 * OAuth endpoints are served by the same Express app under each hostname,
 * so token/authorize/register all answer correctly at either URL.
 */
export function resolveResourceUrl(
  host: string | undefined,
  forwardedProto?: string,
): string {
  if (!host) return BASE_URL;
  const scheme = forwardedProto?.split(",")[0]?.trim() ?? "https";
  return `${scheme}://${host}`;
}

export function protectedResourceMetadata(serverUrl?: string) {
  const url = serverUrl ?? BASE_URL;
  return {
    resource: url,
    authorization_servers: [url],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(serverUrl?: string) {
  const url = serverUrl ?? BASE_URL;
  return {
    issuer: url,
    authorization_endpoint: `${url}/authorize`,
    token_endpoint: `${url}/token`,
    registration_endpoint: `${url}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    agent_auth: {
      register_uri: `${url}/register`,
      identity_types_supported: ["dynamic_client"],
      credential_types_supported: ["oauth2_access_token", "api_key"],
    },
  };
}
