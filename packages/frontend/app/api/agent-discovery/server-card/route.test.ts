import { GET } from "./route";

describe("MCP server card route", () => {
  it("serves a SEP-1649 card with PropertyIQ server info as application/json", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.serverInfo).toEqual({ name: "propertyiq", version: "0.2.0" });
    expect(body.transport).toEqual({
      type: "streamable-http",
      endpoint: "https://mcp.propertyiq.app/mcp",
    });
    expect(body.capabilities.tools).toBeDefined();
    expect(body.authentication.type).toBe("oauth2.1");
    expect(body.authentication.metadata).toBe(
      "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
    );
  });
});
