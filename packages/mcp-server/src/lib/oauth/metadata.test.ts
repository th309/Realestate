import { describe, it, expect } from "vitest";
import {
  authorizationServerMetadata,
  protectedResourceMetadata,
} from "./metadata";

describe("authorizationServerMetadata", () => {
  const md = authorizationServerMetadata("https://mcp.propertyiq.app");

  it("includes an additive agent_auth block in the WorkOS auth.md shape", () => {
    expect(md.agent_auth).toEqual({
      skill: "https://www.propertyiq.app/auth.md",
      identity_endpoint: "https://mcp.propertyiq.app/register",
      claim_endpoint: "https://mcp.propertyiq.app/authorize",
      registration_endpoint: "https://mcp.propertyiq.app/register",
      identity_types_supported: ["service_auth"],
      credential_types_supported: ["oauth2_access_token", "api_key"],
    });
  });

  it("leaves the existing RFC 8414 fields unchanged", () => {
    expect(md.issuer).toBe("https://mcp.propertyiq.app");
    expect(md.authorization_endpoint).toBe(
      "https://mcp.propertyiq.app/authorize",
    );
    expect(md.token_endpoint).toBe("https://mcp.propertyiq.app/token");
    expect(md.registration_endpoint).toBe(
      "https://mcp.propertyiq.app/register",
    );
    expect(md.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
    ]);
    expect(md.code_challenge_methods_supported).toEqual(["S256"]);
  });
});

describe("protectedResourceMetadata", () => {
  it("advertises the mcp scope and header bearer method (RFC 9728)", () => {
    const prm = protectedResourceMetadata("https://mcp.propertyiq.app");
    expect(prm.resource).toBe("https://mcp.propertyiq.app");
    expect(prm.authorization_servers).toEqual(["https://mcp.propertyiq.app"]);
    expect(prm.scopes_supported).toEqual(["mcp"]);
    expect(prm.bearer_methods_supported).toEqual(["header"]);
  });
});
