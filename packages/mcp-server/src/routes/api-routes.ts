/**
 * REST API wrapper for MCP tools — enables ChatGPT Custom GPT Actions.
 *
 * Exposes every MCP tool as POST /api/tools/:toolName and auto-generates
 * an OpenAPI 3.1 schema at GET /api/openapi.json.
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

/** Build a Zod object schema from a tool's schema record */
function buildZodObject(schema: AnySchema): z.ZodObject<any> {
  return z.object(schema);
}

/** Convert a tool's schema record to JSON Schema */
function toJsonSchema(schema: AnySchema) {
  const zodObj = buildZodObject(schema);
  const jsonSchema = (zodToJsonSchema as any)(zodObj, { target: "openApi3" });
  // zodToJsonSchema wraps in { type: "object", properties, required }
  return jsonSchema;
}

/** Build OpenAPI 3.1 spec from all registered tools */
function buildOpenApiSpec() {
  const paths: Record<string, any> = {};

  for (const tool of ALL_TOOLS) {
    const jsonSchema = toJsonSchema(tool.schema);

    paths[`/api/tools/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.description,
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema },
          },
        },
        responses: {
          "200": {
            description: "Tool result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    result: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid input" },
          "401": { description: "Authentication required" },
          "403": { description: "Subscription required" },
          "404": { description: "Tool not found" },
        },
        security: [{ oauth2: [] }],
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "PropertyIQ API",
      description:
        "Real estate market intelligence API. Query PropertyIQ scores, market snapshots, home values, rents, demographics, and more for any US market.",
      version: "0.2.0",
    },
    servers: [{ url: MCP_BASE_URL }],
    paths,
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

// Pre-build the spec once at startup (tools don't change at runtime)
let cachedSpec: ReturnType<typeof buildOpenApiSpec> | null = null;

function getOpenApiSpec() {
  if (!cachedSpec) cachedSpec = buildOpenApiSpec();
  return cachedSpec;
}

// Build a lookup map for tool handlers
const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export function mountApiRoutes(app: Express): void {
  // OpenAPI schema (no auth — ChatGPT needs to fetch this during setup)
  app.get("/api/openapi.json", (_req, res) => {
    console.log("[API] GET /api/openapi.json");
    res.json(getOpenApiSpec());
  });

  // Generic tool invocation endpoint
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

    // Validate input against Zod schema
    const zodObj = buildZodObject(tool.schema as AnySchema);
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
