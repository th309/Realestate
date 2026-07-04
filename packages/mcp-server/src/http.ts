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
import { SERVER_INFO } from "./lib/server-info";
import { mountOAuthRoutes } from "./routes/oauth-routes";
import { mountApiRoutes } from "./routes/api-routes";
import { mountInternalRoutes } from "./routes/internal-routes";

const PORT = parseInt(process.env.PORT || "8080", 10);

// Host allowlist — comma-separated list of hostnames the server will answer
// on. Requests on any other host get 421 Misdirected Request, which closes
// the Host-header spoofing hole in the dynamic protected-resource metadata
// (an attacker pointing DNS at our Railway IP could otherwise coerce the
// server into minting OAuth metadata under their hostname). Default allows
// only the canonical host derived from MCP_BASE_URL; add the Railway URL
// (and any other known-good hosts) via MCP_HOST_ALLOWLIST.
const CANONICAL_HOST = new URL(
  process.env.MCP_BASE_URL || "https://mcp.propertyiq.app",
).host;
const HOST_ALLOWLIST = new Set(
  [
    CANONICAL_HOST,
    ...(process.env.MCP_HOST_ALLOWLIST || "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  ].map((h) => h.toLowerCase()),
);

// Hosts that should be transparently redirected (308) to the canonical host.
// Used to migrate old aliases (e.g. the Railway-generated *.up.railway.app URL)
// without breaking existing user configs — MCP SDKs that follow redirects land
// on the canonical host and OAuth completes cleanly.
const HOST_REDIRECT = new Set(
  (process.env.MCP_HOST_REDIRECT || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

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

// Host redirect — 308 to canonical for known old aliases. Runs before the
// allowlist guard so legacy hosts get migrated instead of 421'd. /health and
// OPTIONS are exempted (platform probes stay local; CORS preflight needs no
// redirect since Access-Control-Allow-Origin is "*"). 308 preserves method
// and body, so POST JSON-RPC calls replay cleanly on the canonical host.
app.use((req, res, next) => {
  if (req.method === "OPTIONS" || req.path === "/health") {
    next();
    return;
  }
  const rawHost =
    (req.headers["x-forwarded-host"] as string | undefined) || req.get("host");
  const host = rawHost?.split(",")[0]?.trim().toLowerCase();
  if (host && HOST_REDIRECT.has(host)) {
    const target = `https://${CANONICAL_HOST}${req.originalUrl}`;
    console.log(`[MCP] 308 redirect | from=${host} | to=${target}`);
    res.redirect(308, target);
    return;
  }
  next();
});

// Host allowlist guard — 421 Misdirected Request on unknown hostnames.
// /health is exempted so Railway's platform probe keeps working on the
// internal hostname. OPTIONS is exempted so CORS preflight works anywhere.
//
// Defense-in-depth: in production this runs BEHIND Railway's edge, which
// already returns 404 (Server: railway-hikari, x-railway-fallback: true) for
// any Host it doesn't recognize — so this 421 path is effectively unreachable
// via the public edge and a spoofed-host probe in prod observes 404, not 421.
// Keep this guard regardless: it's the actual rejection for local dev, direct
// app-layer hits, and any non-Railway deploy where no edge filters hosts first.
app.use((req, res, next) => {
  if (req.method === "OPTIONS" || req.path === "/health") {
    next();
    return;
  }
  const rawHost =
    (req.headers["x-forwarded-host"] as string | undefined) || req.get("host");
  const host = rawHost?.split(",")[0]?.trim().toLowerCase();
  if (!host || !HOST_ALLOWLIST.has(host)) {
    console.log(
      `[MCP] 421 misdirected | host=${host ?? "none"} | path=${req.originalUrl}`,
    );
    res.status(421).json({
      error: "misdirected_request",
      error_description: `This server only answers on the configured host allowlist. Use https://${CANONICAL_HOST} or contact the administrator to add your host.`,
      canonical_url: `https://${CANONICAL_HOST}${req.originalUrl}`,
    });
    return;
  }
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
mountApiRoutes(app);
mountInternalRoutes(app);

// ---------------------------------------------------------------------------
// MCP POST — initialize or tool calls
// Mounted on both "/" (ChatGPT) and "/mcp" (Claude.ai) paths
// ---------------------------------------------------------------------------
const MCP_PATHS = ["/", "/mcp"];

app.post(MCP_PATHS, async (req: Request, res: Response) => {
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
app.get(MCP_PATHS, async (req: Request, res: Response) => {
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
        ...SERVER_INFO,
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
app.delete(MCP_PATHS, async (req: Request, res: Response) => {
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
