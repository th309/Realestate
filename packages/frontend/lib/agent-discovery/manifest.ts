// Canonical, public agent-discovery facts for PropertyIQ. These are public
// canonical URLs (not secrets), so they are intentionally hardcoded here as the
// single source of truth consumed by the well-known route handlers.
export const AGENT_DISCOVERY = {
  siteOrigin: "https://www.propertyiq.app",
  mcp: {
    name: "propertyiq",
    version: "0.2.0", // keep in sync with packages/mcp-server/src/server.ts
    endpoint: "https://mcp.propertyiq.app/mcp",
    transport: "streamable-http",
    auth: "oauth2.1",
    openapi: "https://mcp.propertyiq.app/api/openapi.json",
    health: "https://mcp.propertyiq.app/health",
    docs: "https://www.propertyiq.app/docs/mcp",
    oauthProtectedResource:
      "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
  },
} as const;
