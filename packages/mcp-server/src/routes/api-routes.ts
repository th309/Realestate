/**
 * REST API wrapper for MCP tools — enables ChatGPT Custom GPT Actions.
 *
 * Single endpoint: POST /api/tools with { tool_name, arguments }.
 * OpenAPI schema at GET /api/openapi.json (1 operation, under ChatGPT's 30 limit).
 * Tool catalog at GET /api/tools (for GPT system instructions).
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ALL_TOOLS } from "../server";
import { extractAuth } from "../lib/auth-http";
import { authStore } from "../lib/session-context";

const MCP_BASE_URL = process.env.MCP_BASE_URL || "https://mcp.propertyiq.app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool schema union is too deep for TS
type AnySchema = any;

// Build a lookup map for tool handlers
const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));

/** Build tool catalog — names, descriptions, and parameter schemas */
function buildToolCatalog() {
  return ALL_TOOLS.map((tool) => {
    const zodObj = z.object(tool.schema as AnySchema);
    const params = (zodToJsonSchema as any)(zodObj, { target: "openApi3" });
    return {
      name: tool.name,
      description: tool.description,
      parameters: params,
    };
  });
}

let cachedCatalog: ReturnType<typeof buildToolCatalog> | null = null;
function getToolCatalog() {
  if (!cachedCatalog) cachedCatalog = buildToolCatalog();
  return cachedCatalog;
}

/** OpenAPI 3.1 spec with a single invoke endpoint */
function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "PropertyIQ API",
      description:
        "Real estate market intelligence API. Call invoke_tool with a tool_name and arguments to query PropertyIQ scores, market snapshots, home values, rents, demographics, and more for any US market. GET /api/tools for the full tool catalog.",
      version: "0.2.0",
    },
    servers: [{ url: MCP_BASE_URL }],
    paths: {
      "/api/tools": {
        get: {
          operationId: "list_tools",
          summary: "List all available PropertyIQ tools with their parameters",
          responses: {
            "200": {
              description: "Tool catalog",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        parameters: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "invoke_tool",
          summary:
            "Invoke a PropertyIQ tool by name. Use list_tools to see available tools and their parameters.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tool_name", "arguments"],
                  properties: {
                    tool_name: {
                      type: "string",
                      description:
                        "Tool name from the catalog (e.g. search_markets, get_propertyiq_score, get_market_snapshot)",
                    },
                    arguments: {
                      type: "object",
                      description:
                        "Arguments matching the tool's parameter schema",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tool result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { result: { type: "string" } },
                  },
                },
              },
            },
            "400": { description: "Invalid input or unknown tool" },
            "401": { description: "Authentication required" },
            "403": { description: "Subscription required" },
          },
          security: [{ oauth2: [] }],
        },
      },
    },
    components: {
      securitySchemes: {
        oauth2: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `${MCP_BASE_URL}/authorize`,
              tokenUrl: `${MCP_BASE_URL}/token`,
              scopes: { mcp: "Access PropertyIQ market data" },
            },
          },
        },
      },
    },
  };
}

let cachedSpec: ReturnType<typeof buildOpenApiSpec> | null = null;
function getOpenApiSpec() {
  if (!cachedSpec) cachedSpec = buildOpenApiSpec();
  return cachedSpec;
}

export function mountApiRoutes(app: Express): void {
  // OpenAPI schema (no auth — ChatGPT fetches during setup)
  app.get("/api/openapi.json", (_req, res) => {
    console.log("[API] GET /api/openapi.json");
    res.json(getOpenApiSpec());
  });

  // Tool catalog (no auth — used by GPT instructions and list_tools action)
  app.get("/api/tools", (_req, res) => {
    console.log("[API] GET /api/tools");
    res.json(getToolCatalog());
  });

  // Unified tool invocation
  app.post("/api/tools", async (req: Request, res: Response) => {
    const { tool_name, arguments: args } = req.body ?? {};
    console.log(`[API] POST /api/tools | tool=${tool_name}`);

    if (!tool_name || typeof tool_name !== "string") {
      res.status(400).json({ error: "tool_name is required" });
      return;
    }

    const auth = await extractAuth(req, res);
    if (!auth) return;

    const tool = toolMap.get(tool_name);
    if (!tool) {
      res.status(400).json({
        error: `Unknown tool '${tool_name}'. Use list_tools to see available tools.`,
      });
      return;
    }

    // Validate arguments against tool's Zod schema
    const zodObj = z.object(tool.schema as AnySchema);
    const parsed = zodObj.safeParse(args ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid arguments",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const result = await authStore.run(auth, () => tool.handler(parsed.data));
      res.json({ result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[API] Tool '${tool_name}' error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // Keep the per-tool endpoint for direct API users
  app.post("/api/tools/:toolName", async (req: Request, res: Response) => {
    const { toolName } = req.params;
    console.log(`[API] POST /api/tools/${toolName}`);

    const auth = await extractAuth(req, res);
    if (!auth) return;

    const tool = toolMap.get(toolName as string);
    if (!tool) {
      res.status(404).json({ error: `Tool '${toolName}' not found` });
      return;
    }

    const zodObj = z.object(tool.schema as AnySchema);
    const parsed = zodObj.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const result = await authStore.run(auth, () => tool.handler(parsed.data));
      res.json({ result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[API] Tool '${toolName}' error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });
}
