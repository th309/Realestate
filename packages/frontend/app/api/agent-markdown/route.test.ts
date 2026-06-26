import { GET } from "./route";
import { getAllSlugs } from "@/lib/blog";

function req(path: string): Request {
  return new Request(
    `http://localhost/api/agent-markdown?path=${encodeURIComponent(path)}`,
  );
}

describe("agent-markdown route", () => {
  it("returns text/markdown with Vary + token headers for a blog post", async () => {
    const slug = getAllSlugs()[0];
    const res = await GET(req(`/blog/${slug}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("vary")).toBe("Accept");
    expect(Number(res.headers.get("x-markdown-tokens"))).toBeGreaterThan(0);
    expect((await res.text()).startsWith("# ")).toBe(true);
  });

  it("404s for an unsupported path", async () => {
    const res = await GET(req("/docs/mcp"));
    expect(res.status).toBe(404);
  });
});
