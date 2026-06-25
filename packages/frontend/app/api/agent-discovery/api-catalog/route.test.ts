import { GET } from "./route";

describe("API catalog route", () => {
  it("serves an RFC 9727 linkset advertising the MCP service", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(
      "application/linkset+json",
    );
    const body = await res.json();
    expect(Array.isArray(body.linkset)).toBe(true);
    const entry = body.linkset[0];
    expect(entry.anchor).toBe("https://mcp.propertyiq.app/mcp");
    expect(entry["service-desc"][0].href).toBe(
      "https://mcp.propertyiq.app/api/openapi.json",
    );
    expect(entry["service-doc"][0].href).toBe(
      "https://www.propertyiq.app/docs/mcp",
    );
    expect(entry.status[0].href).toBe("https://mcp.propertyiq.app/health");
  });
});
