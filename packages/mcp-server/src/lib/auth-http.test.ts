import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// We mock all three dependencies extractAuth touches so we can drive each
// branch from the test (no Supabase, no real backend).
vi.mock("./oauth/tokens", () => ({
  lookupAccessToken: vi.fn(),
}));
vi.mock("./api-keys", () => ({
  lookupApiKey: vi.fn(),
}));
vi.mock("./oauth/entitlements-cache", () => ({
  checkEntitlement: vi.fn(),
}));

import { extractAuth } from "./auth-http";
import { lookupAccessToken } from "./oauth/tokens";
import { lookupApiKey } from "./api-keys";
import { checkEntitlement } from "./oauth/entitlements-cache";

const mockedLookupAccessToken = vi.mocked(lookupAccessToken);
const mockedLookupApiKey = vi.mocked(lookupApiKey);
const mockedCheckEntitlement = vi.mocked(checkEntitlement);

// Tiny test harness: a single POST route that calls extractAuth and either
// returns 200 with the resolved auth or relies on extractAuth to send the
// error response.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/test", async (req, res) => {
    const auth = await extractAuth(req, res);
    if (!auth) return; // extractAuth already responded
    res.json({ ok: true, userId: auth.userId });
  });
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("extractAuth — Bearer token routing", () => {
  it("dispatches `piq_live_*` to lookupApiKey, not lookupAccessToken", async () => {
    mockedLookupApiKey.mockResolvedValue({
      userId: "user-pro-1",
      source: "user",
      keyId: "uak-1",
    });
    mockedCheckEntitlement.mockResolvedValue(true);

    const res = await request(buildApp())
      .post("/test")
      .set("Authorization", "Bearer piq_live_abc123");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: "user-pro-1" });
    expect(mockedLookupApiKey).toHaveBeenCalledWith("piq_live_abc123");
    expect(mockedLookupAccessToken).not.toHaveBeenCalled();
    expect(mockedCheckEntitlement).toHaveBeenCalledWith("user-pro-1");
  });

  it("dispatches non-piq_live tokens to lookupAccessToken (OAuth path)", async () => {
    mockedLookupAccessToken.mockResolvedValue({
      userId: "user-oauth-9",
      clientId: "client-x",
    });
    mockedCheckEntitlement.mockResolvedValue(true);

    const res = await request(buildApp())
      .post("/test")
      .set("Authorization", "Bearer 689cbfa42395de918aee6501b33d6db3");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: "user-oauth-9" });
    expect(mockedLookupAccessToken).toHaveBeenCalledWith(
      "689cbfa42395de918aee6501b33d6db3",
    );
    expect(mockedLookupApiKey).not.toHaveBeenCalled();
  });
});

describe("extractAuth — API-key path errors", () => {
  it("returns 401 when API key is unknown / revoked", async () => {
    mockedLookupApiKey.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/test")
      .set("Authorization", "Bearer piq_live_revoked_xyz");

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid|revoked/i);
    expect(mockedCheckEntitlement).not.toHaveBeenCalled();
  });

  it("returns 403 when API key valid but entitlement denied", async () => {
    mockedLookupApiKey.mockResolvedValue({
      userId: "user-downgraded",
      source: "user",
      keyId: "uak-2",
    });
    mockedCheckEntitlement.mockResolvedValue(false);

    const res = await request(buildApp())
      .post("/test")
      .set("Authorization", "Bearer piq_live_downgraded");

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/pro|enterprise|subscription/i);
  });

  it("returns 401 when lookupApiKey throws", async () => {
    mockedLookupApiKey.mockRejectedValue(new Error("supabase down"));

    const res = await request(buildApp())
      .post("/test")
      .set("Authorization", "Bearer piq_live_boom");

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/auth/i);
  });
});

describe("extractAuth — header parsing (regression)", () => {
  it("returns 401 with WWW-Authenticate when no Authorization header", async () => {
    const res = await request(buildApp()).post("/test");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
    expect(mockedLookupApiKey).not.toHaveBeenCalled();
    expect(mockedLookupAccessToken).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization scheme is not Bearer", async () => {
    const res = await request(buildApp())
      .post("/test")
      .set("Authorization", "Basic abc==");
    expect(res.status).toBe(401);
    expect(mockedLookupApiKey).not.toHaveBeenCalled();
    expect(mockedLookupAccessToken).not.toHaveBeenCalled();
  });
});
