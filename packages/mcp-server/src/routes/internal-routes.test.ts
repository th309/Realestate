import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mountInternalRoutes } from "./internal-routes";
import {
  __resetCacheForTests,
  checkEntitlement,
} from "../lib/oauth/entitlements-cache";

const SECRET = "test-secret-abc123";

function buildApp() {
  const app = express();
  app.use(express.json());
  mountInternalRoutes(app);
  return app;
}

describe("POST /internal/entitlements/invalidate", () => {
  beforeEach(() => {
    process.env.MCP_INTERNAL_SECRET = SECRET;
    __resetCacheForTests();
  });

  it("rejects without Authorization header", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .send({ userIds: ["a"] });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("rejects with wrong secret", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", "Bearer wrong")
      .send({ userIds: ["a"] });
    expect(res.status).toBe(401);
  });

  it("rejects when secret is not configured server-side", async () => {
    delete process.env.MCP_INTERNAL_SECRET;
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", "Bearer whatever")
      .send({ userIds: ["a"] });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("internal_secret_not_configured");
  });

  it("rejects non-array body", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", `Bearer ${SECRET}`)
      .send({ userIds: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it("invalidates and returns count", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            access: { "feature:mcp_access": { level: "full" } },
          }),
          { status: 200 },
        ),
    );
    await checkEntitlement("u1");
    await checkEntitlement("u2");

    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", `Bearer ${SECRET}`)
      .send({ userIds: ["u1", "u2", "missing"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invalidated: 2 });
  });

  it("accepts empty userIds array", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", `Bearer ${SECRET}`)
      .send({ userIds: [] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invalidated: 0 });
  });
});
