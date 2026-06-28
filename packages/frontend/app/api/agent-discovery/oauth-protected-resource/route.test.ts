import { GET } from "./route";

describe("oauth-protected-resource well-known route", () => {
  it("serves RFC 9728 metadata that self-identifies the marketing origin and delegates to the MCP authorization server", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    // RFC 9728 origin match: `resource` is the origin that served this document.
    expect(body.resource).toBe("https://www.propertyiq.app");
    expect(body.authorization_servers).toEqual(["https://mcp.propertyiq.app"]);
    expect(body.scopes_supported).toEqual(["mcp"]);
    expect(body.bearer_methods_supported).toEqual(["header"]);
  });
});
