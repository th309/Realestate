import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { ABBREV_TO_STATE } from "@/lib/data/state-slug-data";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

describe("blog post states frontmatter (corpus invariant)", () => {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  it("has posts to validate", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s declares a valid states array", (file) => {
    const { data } = matter.read(path.join(BLOG_DIR, file));
    expect(data.states, `${file} is missing the states key`).toBeDefined();
    expect(Array.isArray(data.states), `${file} states must be an array`).toBe(
      true,
    );
    for (const code of data.states as unknown[]) {
      expect(typeof code).toBe("string");
      expect(
        ABBREV_TO_STATE.has(code as string),
        `${file} has unknown state code "${code}"`,
      ).toBe(true);
    }
  });
});
