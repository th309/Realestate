#!/usr/bin/env node

/**
 * PropertyIQ MCP Server — Remote HTTP Transport
 *
 * Serves the PropertyIQ MCP server over Streamable HTTP.
 * All clients (Claude.ai, Claude Code, Cursor, ChatGPT) connect here.
 *
 * Auth: OAuth 2.1 with PKCE and Dynamic Client Registration.
 */

import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./server";
import { authStore } from "./lib/session-context";
import { extractAuth } from "./lib/auth-http";
import { mountOAuthRoutes } from "./routes/oauth-routes";

const PORT = parseInt(process.env.PORT || "8080", 10);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS — allow browser-based MCP clients (claude.ai connectors, web UIs)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  next();
});

app.options("/{*path}", (_req, res) => {
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------
const transports: Record<string, StreamableHTTPServerTransport> = {};

// ---------------------------------------------------------------------------
// Health check (no auth)
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  console.log("[MCP] GET /health");
  res.json({
    status: "healthy",
    service: "propertyiq-mcp",
    transport: "streamable-http",
  });
});

// ---------------------------------------------------------------------------
// OAuth 2.1 routes (discovery, registration, authorize, callback, token)
// ---------------------------------------------------------------------------
mountOAuthRoutes(app);

// ---------------------------------------------------------------------------
// MCP POST — initialize or tool calls
// ---------------------------------------------------------------------------
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const authHeader = req.headers.authorization;
  const authType = authHeader?.startsWith("Bearer ") ? "oauth" : "none";
  const isInit = isInitializeRequest(req.body);
  console.log(
    `[MCP] POST /mcp | session=${sessionId ?? "none"} | auth=${authType} | initialize=${isInit}`,
  );

  const auth = await extractAuth(req, res);
  if (!auth) return;

  try {
    // Existing session — forward request with auth context
    if (sessionId && transports[sessionId]) {
      console.log(`[MCP] Existing session: ${sessionId}`);
      await authStore.run(auth, () =>
        transports[sessionId].handleRequest(req, res, req.body),
      );
      return;
    }

    // New session — must be initialize request
    if (!sessionId && isInit) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          console.log(`[MCP] New session created: ${sid}`);
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) delete transports[sid];
      };

      const server = createServer();
      await server.connect(transport);
      await authStore.run(auth, () =>
        transport.handleRequest(req, res, req.body),
      );
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    });
  } catch (error) {
    console.error("[PropertyIQ MCP] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// MCP GET — SSE event stream (or unauthenticated server-info probe)
app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const isDiscovery = !sessionId && !req.headers.authorization;
  console.log(
    `[MCP] GET /mcp | session=${sessionId ?? "none"} | discovery_probe=${isDiscovery}`,
  );

  // No session ID and no auth → discovery probe (claude.ai connectors, health checks)
  if (isDiscovery) {
    res.json({
      jsonrpc: "2.0",
      result: {
        name: "propertyiq",
        version: "0.2.0",
        transport: "streamable-http",
        auth: "oauth2.1",
      },
      id: null,
    });
    return;
  }

  // Authenticated SSE stream
  const auth = await extractAuth(req, res);
  if (!auth) return;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await authStore.run(auth, () =>
    transports[sessionId].handleRequest(req, res),
  );
});

// MCP DELETE — session termination
app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  console.log(`[MCP] DELETE /mcp | session=${sessionId ?? "none"}`);
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.error(
    `[PropertyIQ MCP] Streamable HTTP server listening on port ${PORT}`,
  );
});

// Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    for (const sid of Object.keys(transports)) {
      await transports[sid].close();
      delete transports[sid];
    }
    process.exit(0);
  });
}
