#!/usr/bin/env node

/**
 * PropertyIQ MCP Server
 *
 * Exposes PropertyIQ real estate analytics as MCP tools.
 * Communicates over stdio transport for use with Claude Code,
 * Claude Desktop, and other MCP clients.
 *
 * Usage:
 *   npx tsx packages/mcp-server/src/index.ts
 *   claude mcp add propertyiq -- npx tsx packages/mcp-server/src/index.ts
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[PropertyIQ MCP] Server running on stdio");
}

main().catch((err) => {
  console.error("[PropertyIQ MCP] Fatal error:", err);
  process.exit(1);
});
