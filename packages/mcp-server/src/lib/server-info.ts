/**
 * Single source of truth for MCP server identity / version.
 * The public agent-discovery server-card mirrors this at
 * packages/frontend/lib/agent-discovery/manifest.ts (AGENT_DISCOVERY.mcp.version)
 * — bump both together. The frontend test lib/agent-discovery/version-sync.test.ts
 * reads this file and fails the build if the two versions diverge.
 */
export const SERVER_INFO = { name: "propertyiq", version: "0.2.0" } as const;
