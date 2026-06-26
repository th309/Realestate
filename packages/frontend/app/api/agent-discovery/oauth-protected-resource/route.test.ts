import { GET } from "./route";

describe("oauth-protected-resource well-known route", () => {
  it("serves RFC 9728 protected-resource metadata pointing at the MCP server", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.resource).toBe("https://mcp.propertyiq.app");
    expect(body.authorization_servers).toEqual(["https://mcp.propertyiq.app"]);
    expect(body.scopes_supported).toEqual(["mcp"]);
    expect(body.bearer_methods_supported).toEqual(["header"]);
  });
});
