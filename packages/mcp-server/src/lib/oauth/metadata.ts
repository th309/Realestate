const BASE_URL = process.env.MCP_BASE_URL || "https://mcp.propertyiq.app";

/**
 * Derive the resource URL from the incoming request's Host header.
 *
 * MCP SDK clients validate that the `resource` in the protected-resource
 * metadata matches the server URL they connected to. Our server is reachable
 * via two hostnames (custom domain + Railway URL), so we return whichever URL
 * the client actually used rather than a hardcoded canonical URL. The
 * authorization server always stays pinned to BASE_URL (the custom domain).
 */
export function resolveResourceUrl(
  host: string | undefined,
  forwardedProto?: string,
): string {
  if (!host) return BASE_URL;
  const scheme = forwardedProto?.split(",")[0]?.trim() ?? "https";
  return `${scheme}://${host}`;
}

export function protectedResourceMetadata(resourceUrl?: string) {
  return {
    resource: resourceUrl ?? BASE_URL,
    authorization_servers: [BASE_URL],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata() {
  return {
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/authorize`,
    token_endpoint: `${BASE_URL}/token`,
    registration_endpoint: `${BASE_URL}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}
