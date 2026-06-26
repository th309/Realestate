// Canonical, public agent-discovery facts for PropertyIQ. These are public
// canonical URLs (not secrets), so they are intentionally hardcoded here as the
// single source of truth consumed by the well-known route handlers.
export const AGENT_DISCOVERY = {
  siteOrigin: "https://www.propertyiq.app",
  mcp: {
    name: "propertyiq",
    // SINGLE SOURCE OF TRUTH for the MCP version is packages/mcp-server/src/lib/
    // server-info.ts (SERVER_INFO.version). This served server-card value MUST
    // equal it — bump both together. Drift is caught by the build:
    // lib/agent-discovery/version-sync.test.ts fails if these diverge.
    version: "0.2.0",
    endpoint: "https://mcp.propertyiq.app/mcp",
    transport: "streamable-http",
    auth: "oauth2.1",
    openapi: "https://mcp.propertyiq.app/api/openapi.json",
    health: "https://mcp.propertyiq.app/health",
    docs: "https://www.propertyiq.app/docs/mcp",
    oauthProtectedResource:
      "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
    oauthAuthorizationServer:
      "https://mcp.propertyiq.app/.well-known/oauth-authorization-server",
    // OAuth scopes advertised in the apex protected-resource metadata (RFC 9728).
    scopes: ["mcp"],
  },
} as const;
