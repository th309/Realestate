import { describe, it, expect } from "vitest";
import { authorizationServerMetadata } from "./metadata";

describe("authorizationServerMetadata", () => {
  const md = authorizationServerMetadata("https://mcp.propertyiq.app");

  it("includes an additive agent_auth block", () => {
    expect(md.agent_auth).toEqual({
      register_uri: "https://mcp.propertyiq.app/register",
      identity_types_supported: ["dynamic_client"],
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
