#!/usr/bin/env node

/**
 * PropertyIQ MCP Server
 *
 * Exposes PropertyIQ real estate analytics as MCP tools.
 * Authenticates via stored credentials, env var, or device flow.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { config, resolveApiKey } from "./lib/config";
import { authenticate } from "./lib/auth";

async function main() {
  // Resolve API key: stored credentials → env var → device flow
  let apiKey = resolveApiKey();

  if (!apiKey) {
    apiKey = await authenticate(config.apiUrl);
    config.apiKey = apiKey;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[PropertyIQ MCP] Server running on stdio (authenticated)");
}

main().catch((err) => {
  console.error("[PropertyIQ MCP] Fatal error:", err);
  process.exit(1);
});
