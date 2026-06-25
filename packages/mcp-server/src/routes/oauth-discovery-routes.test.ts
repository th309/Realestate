import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { mountOAuthDiscoveryRoutes } from "./oauth-discovery-routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  mountOAuthDiscoveryRoutes(app);
  return app;
}

describe("GET /.well-known/mcp/server-card.json", () => {
  it("serves an unauthenticated SEP-1649 server card derived from the request host", async () => {
    const res = await request(buildApp())
      .get("/.well-known/mcp/server-card.json")
      .set("Host", "mcp.propertyiq.app");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.serverInfo).toEqual({
      name: "propertyiq",
      version: "0.2.0",
    });
    expect(res.body.transport).toEqual({
      type: "streamable-http",
      endpoint: "https://mcp.propertyiq.app/mcp",
    });
    expect(res.body.capabilities.tools).toBeDefined();
    expect(res.body.authentication).toEqual({
      type: "oauth2.1",
      metadata:
        "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
    });
  });
});
