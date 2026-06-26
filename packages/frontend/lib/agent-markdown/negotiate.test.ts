import { NextRequest } from "next/server";
import {
  isMarkdownContentRoute,
  wantsMarkdown,
  markdownNegotiationRewrite,
} from "./negotiate";

describe("markdown negotiation", () => {
  it("recognizes the supported content routes only", () => {
    expect(isMarkdownContentRoute("/blog/some-post")).toBe(true);
    expect(isMarkdownContentRoute("/scores/methodology")).toBe(true);
    expect(isMarkdownContentRoute("/blog")).toBe(false);
    expect(isMarkdownContentRoute("/docs/mcp")).toBe(false);
    expect(isMarkdownContentRoute("/blog/a/b")).toBe(false);
  });

  it("detects a markdown Accept header", () => {
    expect(wantsMarkdown("text/markdown")).toBe(true);
    expect(wantsMarkdown("text/html,application/xhtml+xml")).toBe(false);
    expect(wantsMarkdown(null)).toBe(false);
  });

  it("rewrites a markdown-negotiated content request to /api/agent-markdown", () => {
    const req = new NextRequest("https://www.propertyiq.app/blog/some-post", {
      headers: { accept: "text/markdown" },
    });
    const res = markdownNegotiationRewrite(req);
    expect(res).not.toBeNull();
    expect(res!.headers.get("vary")).toBe("Accept");
    expect(res!.headers.get("x-middleware-rewrite")).toContain(
      "/api/agent-markdown",
    );
    // The original path is forwarded to the handler via an overridden request
    // header (not a query param — those don't survive a rewrite).
    expect(res!.headers.get("x-middleware-override-headers")).toContain(
      "x-md-pathname",
    );
  });

  it("returns null for a browser (text/html) request", () => {
    const req = new NextRequest("https://www.propertyiq.app/blog/some-post", {
      headers: { accept: "text/html" },
    });
    expect(markdownNegotiationRewrite(req)).toBeNull();
  });

  it("returns null for an unsupported route even with a markdown Accept", () => {
    const req = new NextRequest("https://www.propertyiq.app/docs/mcp", {
      headers: { accept: "text/markdown" },
    });
    expect(markdownNegotiationRewrite(req)).toBeNull();
  });
});
