import { GET } from "./route";

const req = () => new Request("https://www.propertyiq.app");

describe("agent-skill SKILL.md well-known route", () => {
  it("serves markdown for a known skill with valid frontmatter", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ name: "propertyiq-market-analysis" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body.startsWith("---\n")).toBe(true);
    expect(body).toContain("name: propertyiq-market-analysis");
    expect(body).toContain("description:");
  });

  it("returns 404 for an unknown skill", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ name: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });
});
