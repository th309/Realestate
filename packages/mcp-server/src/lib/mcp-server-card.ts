import { SERVER_INFO } from "./server-info";

// MCP Server Card (SEP-1649), built from this server's identity.
export function buildServerCard(serverUrl: string) {
  return {
    serverInfo: SERVER_INFO,
    transport: { type: "streamable-http", endpoint: `${serverUrl}/mcp` },
    capabilities: { tools: {} },
    authentication: {
      type: "oauth2.1",
      metadata: `${serverUrl}/.well-known/oauth-protected-resource`,
    },
    documentation: "https://www.propertyiq.app/docs/mcp",
  };
}
