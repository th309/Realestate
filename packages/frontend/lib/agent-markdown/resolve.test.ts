import { vi } from "vitest";
import { resolveMarkdown } from "./resolve";
import { getAllSlugs } from "@/lib/blog";
import * as methodologyReport from "@/lib/scores/methodology-report";

describe("resolveMarkdown", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns markdown for a real blog post, prefixed with its title", () => {
    const slug = getAllSlugs()[0];
    expect(slug).toBeTruthy();
    const md = resolveMarkdown(`/blog/${slug}`);
    expect(md).not.toBeNull();
    expect(md!.startsWith("# ")).toBe(true);
  });

  it("returns markdown for the methodology page", () => {
    const md = resolveMarkdown("/scores/methodology");
    expect(md).not.toBeNull();
    expect(md!.length).toBeGreaterThan(100);
  });

  it("returns curated markdown for the static marketing pages", () => {
    for (const path of ["/", "/markets", "/pricing", "/scores"]) {
      const md = resolveMarkdown(path);
      expect(md).not.toBeNull();
      expect(md!.startsWith("# ")).toBe(true);
      expect(md!.length).toBeGreaterThan(100);
    }
  });

  it("returns null for the blog index, a docs path, and a missing slug", () => {
    expect(resolveMarkdown("/blog")).toBeNull();
    expect(resolveMarkdown("/docs/mcp")).toBeNull();
    expect(resolveMarkdown("/blog/this-slug-does-not-exist-xyz")).toBeNull();
  });

  it("returns null when the methodology report read fails", () => {
    vi.spyOn(methodologyReport, "readMethodologyReport").mockImplementationOnce(
      () => {
        throw new Error("ENOENT");
      },
    );
    expect(resolveMarkdown("/scores/methodology")).toBeNull();
  });
});
