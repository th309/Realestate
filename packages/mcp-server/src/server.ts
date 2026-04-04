import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DISCLAIMER } from "./lib/disclaimer";
import { coreTools } from "./tools/core";
import { contentSeoTools } from "./tools/content-seo";
import { agentTools } from "./tools/agents";
import { investorTools } from "./tools/investors";
import { brokerageTools } from "./tools/brokerage";
import { propertyManagerTools } from "./tools/property-managers";

/** All tool arrays, flattened into one list */
export const ALL_TOOLS = [
  ...coreTools,
  ...contentSeoTools,
  ...agentTools,
  ...investorTools,
  ...brokerageTools,
  ...propertyManagerTools,
];

export function createServer(): McpServer {
  const server = new McpServer({
    name: "propertyiq",
    version: "0.2.0",
  });

  // Register each tool. The `as any` on `register` avoids TS2589 ("type
  // instantiation is excessively deep") caused by the union of 35+ distinct
  // schema shapes hitting the MCP SDK's overloaded `.tool()` signature.
  const register = server.tool.bind(server) as (
    name: string,
    description: string,
    schema: Record<string, unknown>,
    cb: (args: Record<string, unknown>) => Promise<{
      content: { type: "text"; text: string }[];
      isError?: boolean;
    }>,
  ) => void;

  for (const tool of ALL_TOOLS) {
    register(tool.name, tool.description, tool.schema, async (args) => {
      try {
        const text = await tool.handler(args);
        return {
          content: [
            { type: "text" as const, text },
            { type: "text" as const, text: DATA_DISCLAIMER },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    });
  }

  return server;
}
