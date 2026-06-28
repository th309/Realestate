import { GET } from "./route";

describe("oauth-authorization-server well-known route", () => {
  it("serves RFC 8414 metadata mirroring the MCP host with an agent_auth skill", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.issuer).toBe("https://mcp.propertyiq.app");
    expect(body.authorization_endpoint).toBe(
      "https://mcp.propertyiq.app/authorize",
    );
    expect(body.token_endpoint).toBe("https://mcp.propertyiq.app/token");
    expect(body.registration_endpoint).toBe(
      "https://mcp.propertyiq.app/register",
    );
    expect(body.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
    ]);
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    // agent_auth uses the WorkOS auth.md schema the isitagentready checker validates.
    expect(body.agent_auth.skill).toBe("https://www.propertyiq.app/auth.md");
    expect(body.agent_auth.register_uri).toBe(
      "https://mcp.propertyiq.app/register",
    );
    expect(body.agent_auth.identity_endpoint).toBe(
      "https://mcp.propertyiq.app/register",
    );
    expect(body.agent_auth.claim_endpoint).toBe(
      "https://mcp.propertyiq.app/authorize",
    );
    expect(body.agent_auth.identity_types_supported).toEqual(["service_auth"]);
  });
});
