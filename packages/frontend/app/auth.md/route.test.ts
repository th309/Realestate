import { GET } from "./route";

describe("auth.md route", () => {
  it("serves an agent auth guide as text/markdown", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# PropertyIQ — Agent Authentication");
    expect(body).toContain("https://mcp.propertyiq.app/register");
    expect(body).toContain(
      "https://mcp.propertyiq.app/.well-known/oauth-authorization-server",
    );
    expect(body).toContain("piq_live_");
    expect(body).toContain("/.well-known/api-catalog");
  });
});
