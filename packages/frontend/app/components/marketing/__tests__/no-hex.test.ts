import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..");
const ARBITRARY_HEX = /\[#[0-9A-Fa-f]{3,8}\]/;

/**
 * The marketing surfaces previously carried 604 hardcoded hex literals across
 * 119 files, running alongside the M3 token system. The two disagreed, and in
 * dark mode the tokens flipped while the hex did not. This guard stops that
 * class of drift returning.
 */
describe("marketing primitives use semantic tokens only", () => {
  const files = readdirSync(DIR).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
  );

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no arbitrary hex utility", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(ARBITRARY_HEX);
  });

  it.each(files)("%s contains no bare hex colour literal", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(
      /#[0-9A-Fa-f]{6}\b/,
    );
  });
});
