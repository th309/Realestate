/**
 * Single source of truth for MCP server identity / version.
 * The public agent-discovery server-card mirrors this at
 * packages/frontend/lib/agent-discovery/manifest.ts (AGENT_DISCOVERY.mcp.version)
 * — bump both together until a cross-package assertion is added.
 */
export const SERVER_INFO = { name: "propertyiq", version: "0.2.0" } as const;
