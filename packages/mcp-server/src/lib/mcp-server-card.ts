// MCP Server Card (SEP-1649), built from this server's identity. name/version are
// inline to match the existing inline usages in server.ts / http.ts / api-routes.ts
// (they are not exported as constants).
// keep in sync with packages/mcp-server/src/server.ts
export function buildServerCard(serverUrl: string) {
  return {
    serverInfo: { name: "propertyiq", version: "0.2.0" },
    transport: { type: "streamable-http", endpoint: `${serverUrl}/mcp` },
    capabilities: { tools: {} },
    authentication: {
      type: "oauth2.1",
      metadata: `${serverUrl}/.well-known/oauth-protected-resource`,
    },
    documentation: "https://www.propertyiq.app/docs/mcp",
  };
}
