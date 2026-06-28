import { GET } from "./route";

describe("auth.md route", () => {
  it("serves an agent auth guide as text/markdown", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# PropertyIQ auth.md — Agent Authentication");
    // WorkOS auth.md requires the H1 to contain the literal string "auth.md".
    expect(body).toMatch(/^#[^\n]*auth\.md/);
    expect(body).toContain("https://mcp.propertyiq.app/register");
    // Machine-readable agent_auth block (WorkOS auth.md convention) with the
    // register_uri the isitagentready checker validates.
    expect(body).toContain("agent_auth");
    expect(body).toContain(
      '"register_uri": "https://mcp.propertyiq.app/register"',
    );
    // The recognized "anonymous" registration method (open RFC 7591 DCR).
    expect(body).toContain('"claim_uri": "https://mcp.propertyiq.app/token"');
    expect(body).toContain('"identity_types_supported": ["anonymous"]');
    expect(body).toContain(
      "https://mcp.propertyiq.app/.well-known/oauth-authorization-server",
    );
    expect(body).toContain("piq_live_");
    expect(body).toContain("/.well-known/api-catalog");
  });
});
