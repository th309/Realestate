import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DISCLAIMER } from "./lib/disclaimer";
import { coreTools } from "./tools/core";
import { contentSeoTools } from "./tools/content-seo";
import { agentTools } from "./tools/agents";
import { investorTools } from "./tools/investors";
import { brokerageTools } from "./tools/brokerage";
import { propertyManagerTools } from "./tools/property-managers";

/** All tool arrays, flattened into one list */
const ALL_TOOLS = [
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

  for (const tool of ALL_TOOLS) {
    server.tool(tool.name, tool.description, tool.schema, async (args: any) => {
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
