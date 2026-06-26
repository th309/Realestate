import fs from "fs";
import { resolveMarkdown } from "./resolve";
import { getAllSlugs } from "@/lib/blog";

describe("resolveMarkdown", () => {
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

  it("returns null for the blog index, a docs path, and a missing slug", () => {
    expect(resolveMarkdown("/blog")).toBeNull();
    expect(resolveMarkdown("/docs/mcp")).toBeNull();
    expect(resolveMarkdown("/blog/this-slug-does-not-exist-xyz")).toBeNull();
  });

  it("returns null when the methodology report read fails", () => {
    const spy = vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    expect(resolveMarkdown("/scores/methodology")).toBeNull();
    spy.mockRestore();
  });
});
