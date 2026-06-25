import { GET } from "./route";

describe("robots.txt route", () => {
  it("emits the Content-Signal directive under User-agent: *", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain(
      "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    );
  });

  it("preserves the existing allow/disallow + AI-bot rules + sitemap", async () => {
    const body = await (await GET()).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Allow: /api/og");
    for (const path of [
      "/api/",
      "/admin/",
      "/auth/",
      "/account/",
      "/dev/",
      "/health/",
      "/betatest/",
    ]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    for (const bot of [
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Bingbot",
      "GPTBot",
      "ClaudeBot",
      "Google-Extended",
    ]) {
      expect(body).toContain(`User-agent: ${bot}`);
    }
    expect(body).toContain("Sitemap: https://www.propertyiq.app/sitemap.xml");
  });
});
